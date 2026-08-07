import { useState } from 'react';
import { IconButton, Tooltip, Menu, MenuItem, ListItemIcon, ListItemText, CircularProgress } from '@mui/material';
import ShareRoundedIcon from '@mui/icons-material/ShareRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';

export default function ExportButton({ targetRef, filename = 'football-export', title = '' }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [exporting, setExporting] = useState(false);

  const handleExportPNG = async () => {
    setAnchorEl(null);
    if (!targetRef?.current) return;
    setExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(targetRef.current, {
        backgroundColor: '#0a0e1a',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const link = document.createElement('a');
      link.download = `${filename}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      console.error('Export failed:', e);
    }
    setExporting(false);
  };

  const handleCopyImage = async () => {
    setAnchorEl(null);
    if (!targetRef?.current) return;
    setExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(targetRef.current, {
        backgroundColor: '#0a0e1a',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      canvas.toBlob(async (blob) => {
        if (blob) {
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
          } catch (e) {
            // Fallback: download if clipboard fails
            const link = document.createElement('a');
            link.download = `${filename}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
          }
        }
      }, 'image/png');
    } catch (e) {
      console.error('Copy failed:', e);
    }
    setExporting(false);
  };

  const handleShare = async () => {
    setAnchorEl(null);
    if (!targetRef?.current) return;
    setExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(targetRef.current, {
        backgroundColor: '#0a0e1a',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      canvas.toBlob(async (blob) => {
        if (blob && navigator.share) {
          const file = new File([blob], `${filename}.png`, { type: 'image/png' });
          try {
            await navigator.share({
              title: title || filename,
              files: [file],
            });
          } catch (e) {
            // User cancelled or share failed - fallback to download
            const link = document.createElement('a');
            link.download = `${filename}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
          }
        } else {
          // No Web Share API - just download
          const link = document.createElement('a');
          link.download = `${filename}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
        }
      }, 'image/png');
    } catch (e) {
      console.error('Share failed:', e);
    }
    setExporting(false);
  };

  return (
    <>
      <Tooltip title="Export & Share">
        <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} disabled={exporting}
          sx={{ color: 'primary.main', p: 1 }}>
          {exporting ? <CircularProgress size={18} color="primary" /> : <ShareRoundedIcon sx={{ fontSize: 20 }} />}
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}
        PaperProps={{ sx: { bgcolor: '#1a2035', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2, minWidth: 180 } }}>
        <MenuItem onClick={handleExportPNG} sx={{ gap: 1.5 }}>
          <ListItemIcon><DownloadRoundedIcon sx={{ fontSize: 18, color: '#00e676' }} /></ListItemIcon>
          <ListItemText primaryTypographyProps={{ fontSize: 13, fontWeight: 600 }}>Save as PNG</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleCopyImage} sx={{ gap: 1.5 }}>
          <ListItemIcon><ContentCopyRoundedIcon sx={{ fontSize: 18, color: '#40c4ff' }} /></ListItemIcon>
          <ListItemText primaryTypographyProps={{ fontSize: 13, fontWeight: 600 }}>Copy to Clipboard</ListItemText>
        </MenuItem>
        {navigator.share && (
          <MenuItem onClick={handleShare} sx={{ gap: 1.5 }}>
            <ListItemIcon><ShareRoundedIcon sx={{ fontSize: 18, color: '#651fff' }} /></ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontSize: 13, fontWeight: 600 }}>Share</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </>
  );
}
