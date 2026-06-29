import { Box, Typography, keyframes } from '@mui/material';

// ── Keyframe animations ───────────────────────────────────────────────────────
const pulse = keyframes`
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.05); }
`;

const spin = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const bounce = keyframes`
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
`;

const float = keyframes`
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-8px); }
`;

// ── Variants ──────────────────────────────────────────────────────────────────

function FootballSpinner({ size = 48 }) {
  return (
    <Box sx={{ position: 'relative', width: size, height: size }}>
      {/* Outer ring */}
      <Box sx={{
        position: 'absolute', inset: 0,
        borderRadius: '50%',
        border: '3px solid rgba(255,255,255,0.06)',
        borderTopColor: '#00e676',
        borderRightColor: '#651fff',
        animation: `${spin} 1s linear infinite`,
      }} />
      {/* Inner ball emoji */}
      <Box sx={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.4,
        animation: `${pulse} 1.5s ease-in-out infinite`,
      }}>
        ⚽
      </Box>
    </Box>
  );
}

function BouncingDots() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {[0, 1, 2].map(i => (
        <Box key={i} sx={{
          width: 10, height: 10, borderRadius: '50%',
          background: i === 0 ? '#00e676' : i === 1 ? '#651fff' : '#ff5252',
          animation: `${bounce} 1.4s ease-in-out infinite`,
          animationDelay: `${i * 0.16}s`,
        }} />
      ))}
    </Box>
  );
}

function ShimmerCards({ count = 3 }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 1.5 }}>
      {Array.from({ length: count }).map((_, i) => (
        <Box key={i} sx={{
          height: 120,
          borderRadius: '18px',
          background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%)',
          backgroundSize: '200% 100%',
          animation: `${shimmer} 1.5s ease-in-out infinite`,
          animationDelay: `${i * 0.15}s`,
          border: '1px solid rgba(255,255,255,0.05)',
        }} />
      ))}
    </Box>
  );
}

function ShimmerRows({ count = 4 }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {Array.from({ length: count }).map((_, i) => (
        <Box key={i} sx={{
          height: 56,
          borderRadius: 2,
          background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%)',
          backgroundSize: '200% 100%',
          animation: `${shimmer} 1.5s ease-in-out infinite`,
          animationDelay: `${i * 0.12}s`,
          border: '1px solid rgba(255,255,255,0.05)',
        }} />
      ))}
    </Box>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

/**
 * Beautiful loading state component with multiple variants.
 *
 * @param {'spinner' | 'dots' | 'cards' | 'rows' | 'full'} variant
 * @param {string} message - Optional message to display below the loader
 * @param {number} count - Number of shimmer items (for cards/rows variants)
 * @param {boolean} fullHeight - Whether to take full available height
 */
export default function LoadingState({
  variant = 'full',
  message = 'Loading...',
  count = 4,
  fullHeight = false,
}) {
  if (variant === 'cards') return <ShimmerCards count={count} />;
  if (variant === 'rows') return <ShimmerRows count={count} />;

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2.5,
      py: fullHeight ? 0 : { xs: 6, sm: 10 },
      minHeight: fullHeight ? '60vh' : 'auto',
    }}>
      {variant === 'dots' ? (
        <BouncingDots />
      ) : (
        <FootballSpinner size={56} />
      )}

      {message && (
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body2" sx={{
            fontWeight: 600,
            color: 'text.secondary',
            fontSize: 13,
            animation: `${float} 2s ease-in-out infinite`,
          }}>
            {message}
          </Typography>
        </Box>
      )}

      {/* Decorative gradient bar */}
      <Box sx={{
        width: 80,
        height: 3,
        borderRadius: 2,
        background: 'linear-gradient(90deg, #00e676, #651fff, #ff5252)',
        backgroundSize: '200% 100%',
        animation: `${shimmer} 2s linear infinite`,
        opacity: 0.6,
      }} />
    </Box>
  );
}
