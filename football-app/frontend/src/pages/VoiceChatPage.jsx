import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Typography, Button, IconButton, Paper, Avatar, Chip,
  TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  Stack, Alert, Tooltip
} from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import CallEndIcon from '@mui/icons-material/CallEnd';
import AddIcon from '@mui/icons-material/Add';
import HeadsetMicIcon from '@mui/icons-material/HeadsetMic';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import PeopleIcon from '@mui/icons-material/People';
import io from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

function getInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function VoiceChatPage() {
  const [user] = useState(() => JSON.parse(localStorage.getItem('fp_user') || 'null'));
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [muted, setMuted] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(false);

  const socketRef = useRef(null);
  const peersRef = useRef(new Map()); // socketId -> RTCPeerConnection
  const streamRef = useRef(null);
  const audioElements = useRef(new Map());

  // Fetch existing rooms
  const fetchRooms = useCallback(async () => {
    if (!user?.code) return;
    try {
      const res = await fetch(`${API_URL}/api/voice/rooms/${user.code}`);
      const data = await res.json();
      setRooms(data);
    } catch (e) {
      console.error('Failed to fetch voice rooms:', e);
    }
  }, [user?.code]);

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
  }, [fetchRooms]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      leaveRoom();
    };
  }, []);

  const createPeerConnection = (targetSocketId) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Add local audio tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, streamRef.current);
      });
    }

    // Send ICE candidates to remote peer
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit('voice:signal', {
          to: targetSocketId,
          signal: { type: 'candidate', candidate: event.candidate }
        });
      }
    };

    // Play remote audio when we receive a track
    pc.ontrack = (event) => {
      let audio = audioElements.current.get(targetSocketId);
      if (!audio) {
        audio = new Audio();
        audio.autoplay = true;
        audioElements.current.set(targetSocketId, audio);
      }
      audio.srcObject = event.streams[0];
      audio.play().catch(() => {});
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        destroyPeer(targetSocketId);
      }
    };

    peersRef.current.set(targetSocketId, pc);
    return pc;
  };

  const createOffer = async (targetSocketId) => {
    const pc = createPeerConnection(targetSocketId);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current?.emit('voice:signal', {
        to: targetSocketId,
        signal: { type: 'offer', sdp: pc.localDescription }
      });
    } catch (err) {
      console.error('Failed to create offer:', err);
    }
  };

  const handleOffer = async (fromSocketId, sdp) => {
    const pc = createPeerConnection(fromSocketId);
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketRef.current?.emit('voice:signal', {
        to: fromSocketId,
        signal: { type: 'answer', sdp: pc.localDescription }
      });
    } catch (err) {
      console.error('Failed to handle offer:', err);
    }
  };

  const handleAnswer = async (fromSocketId, sdp) => {
    const pc = peersRef.current.get(fromSocketId);
    if (pc) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      } catch (err) {
        console.error('Failed to set remote description:', err);
      }
    }
  };

  const handleCandidate = async (fromSocketId, candidate) => {
    const pc = peersRef.current.get(fromSocketId);
    if (pc) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('Failed to add ICE candidate:', err);
      }
    }
  };

  const destroyPeer = (socketId) => {
    const pc = peersRef.current.get(socketId);
    if (pc) {
      pc.close();
      peersRef.current.delete(socketId);
    }
    const audio = audioElements.current.get(socketId);
    if (audio) {
      audio.srcObject = null;
      audioElements.current.delete(socketId);
    }
  };

  const connectSocket = () => {
    if (socketRef.current) return socketRef.current;
    const socket = io(API_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('voice:peers', (peers) => {
      // Create outgoing peer connections (offers) to everyone already in the room
      peers.forEach(peer => {
        createOffer(peer.socketId);
      });
    });

    socket.on('voice:user-joined', ({ socketId }) => {
      // New user joined - they will send us an offer, we wait
      // Actually the new joiner sends offers to existing peers (handled in voice:peers)
      // So we do nothing here - the new user will initiate
    });

    socket.on('voice:signal', ({ from, signal }) => {
      if (signal.type === 'offer') {
        handleOffer(from, signal.sdp);
      } else if (signal.type === 'answer') {
        handleAnswer(from, signal.sdp);
      } else if (signal.type === 'candidate') {
        handleCandidate(from, signal.candidate);
      }
    });

    socket.on('voice:user-left', ({ socketId }) => {
      destroyPeer(socketId);
    });

    socket.on('voice:user-muted', ({ socketId, muted: isMuted }) => {
      setParticipants(prev => prev.map(p =>
        p.socketId === socketId ? { ...p, muted: isMuted } : p
      ));
    });

    socket.on('voice:participants', (list) => {
      setParticipants(list);
    });

    return socket;
  };

  const joinRoom = async (roomId, roomName) => {
    if (currentRoom) return;
    setError('');
    setConnecting(true);

    try {
      // Get mic access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      const socket = connectSocket();
      socket.emit('voice:join', { roomId, userId: user.id, userName: user.name });
      setCurrentRoom({ id: roomId, name: roomName });
      setConnecting(false);
    } catch (err) {
      console.error('Failed to join voice room:', err);
      setError(err.name === 'NotAllowedError'
        ? 'Microphone access denied. Please allow microphone access and try again.'
        : 'Failed to connect to voice room. Please try again.');
      setConnecting(false);
    }
  };

  const leaveRoom = () => {
    // Stop all peers
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();

    // Stop audio elements
    audioElements.current.forEach((audio) => { audio.srcObject = null; });
    audioElements.current.clear();

    // Stop local stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Notify server
    socketRef.current?.emit('voice:leave');
    socketRef.current?.disconnect();
    socketRef.current = null;

    setCurrentRoom(null);
    setParticipants([]);
    setMuted(false);
  };

  const toggleMute = () => {
    if (!streamRef.current) return;
    const audioTrack = streamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = muted; // toggle (if muted=true, we enable it)
      setMuted(!muted);
      socketRef.current?.emit('voice:mute', { muted: !muted });
    }
  };

  const handleCreateRoom = () => {
    if (!newRoomName.trim()) return;
    const roomId = `voice-${user.code}-${newRoomName.trim().toLowerCase().replace(/\s+/g, '-')}`;
    setCreateOpen(false);
    joinRoom(roomId, newRoomName.trim());
    setNewRoomName('');
  };

  if (!user) return null;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <HeadsetMicIcon sx={{ color: 'primary.main', fontSize: 28 }} />
          <Typography variant="h5" sx={{ fontWeight: 800 }}>Voice Chat</Typography>
        </Box>
        {!currentRoom && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateOpen(true)}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
          >
            New Room
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Currently in a room */}
      {currentRoom && (
        <Paper
          sx={{
            p: 3, borderRadius: 3, mb: 3,
            background: 'linear-gradient(135deg, rgba(0,230,118,0.08), rgba(101,31,255,0.08))',
            border: '1px solid rgba(0,230,118,0.2)'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <VolumeUpIcon sx={{ color: '#00e676', animation: 'pulse 1.5s infinite' }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>{currentRoom.name}</Typography>
              <Chip label={`${participants.length} connected`} size="small" icon={<PeopleIcon />}
                sx={{ ml: 1, fontWeight: 600 }} />
            </Box>
          </Box>

          {/* Participants grid */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
            {participants.map(p => (
              <Box key={p.socketId} sx={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5,
                p: 1.5, borderRadius: 2,
                background: p.userId === user.id ? 'rgba(0,230,118,0.12)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${p.userId === user.id ? 'rgba(0,230,118,0.3)' : 'rgba(255,255,255,0.06)'}`,
                minWidth: 80
              }}>
                <Avatar sx={{
                  width: 44, height: 44, fontSize: 14, fontWeight: 800,
                  background: p.muted ? 'rgba(255,82,82,0.3)' : 'linear-gradient(135deg,#00e676,#651fff)',
                  border: p.muted ? '2px solid #ff5252' : '2px solid #00e676'
                }}>
                  {getInitials(p.userName)}
                </Avatar>
                <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 11, textAlign: 'center' }} noWrap>
                  {p.userName}{p.userId === user.id ? ' (You)' : ''}
                </Typography>
                {p.muted && (
                  <MicOffIcon sx={{ fontSize: 14, color: '#ff5252' }} />
                )}
              </Box>
            ))}
          </Box>

          {/* Controls */}
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
            <Tooltip title={muted ? 'Unmute' : 'Mute'}>
              <IconButton
                onClick={toggleMute}
                sx={{
                  width: 52, height: 52,
                  bgcolor: muted ? 'rgba(255,82,82,0.2)' : 'rgba(0,230,118,0.15)',
                  border: `2px solid ${muted ? '#ff5252' : '#00e676'}`,
                  '&:hover': { bgcolor: muted ? 'rgba(255,82,82,0.3)' : 'rgba(0,230,118,0.25)' }
                }}
              >
                {muted ? <MicOffIcon sx={{ color: '#ff5252' }} /> : <MicIcon sx={{ color: '#00e676' }} />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Leave Room">
              <IconButton
                onClick={leaveRoom}
                sx={{
                  width: 52, height: 52,
                  bgcolor: 'rgba(255,82,82,0.2)',
                  border: '2px solid #ff5252',
                  '&:hover': { bgcolor: 'rgba(255,82,82,0.4)' }
                }}
              >
                <CallEndIcon sx={{ color: '#ff5252' }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Paper>
      )}

      {/* Available Rooms */}
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5, color: 'text.secondary' }}>
        {currentRoom ? 'Other Rooms' : 'Voice Rooms'}
      </Typography>

      {rooms.length === 0 && !currentRoom && (
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <HeadsetMicIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.4, mb: 1 }} />
          <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 600 }}>
            No voice rooms active
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Create a room to start talking with your group
          </Typography>
        </Paper>
      )}

      <Stack spacing={1.5}>
        {rooms.filter(r => !currentRoom || r.id !== currentRoom.id).map(room => (
          <Paper key={room.id} sx={{
            p: 2, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
            '&:hover': { background: 'rgba(255,255,255,0.04)' }, transition: 'background 0.2s'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{
                width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,230,118,0.12)', border: '1px solid rgba(0,230,118,0.3)'
              }}>
                <VolumeUpIcon sx={{ fontSize: 18, color: '#00e676' }} />
              </Box>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{room.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {room.participants.length} {room.participants.length === 1 ? 'person' : 'people'} talking
                </Typography>
              </Box>
            </Box>
            <Button
              variant="outlined"
              size="small"
              onClick={() => joinRoom(room.id, room.name)}
              disabled={!!currentRoom || connecting}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
            >
              Join
            </Button>
          </Paper>
        ))}
      </Stack>

      {/* Create Room Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)}
        PaperProps={{ sx: { bgcolor: '#1a2035', borderRadius: 3, border: '1px solid rgba(255,255,255,0.1)', minWidth: 320 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Create Voice Room</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Room Name"
            placeholder="e.g. Match Discussion, Team Talk"
            value={newRoomName}
            onChange={e => setNewRoomName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateRoom()}
            sx={{ mt: 1 }}
            inputProps={{ maxLength: 30 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateRoom} disabled={!newRoomName.trim()}
            sx={{ textTransform: 'none', fontWeight: 700 }}>
            Create & Join
          </Button>
        </DialogActions>
      </Dialog>

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </Box>
  );
}
