import { Box, Typography } from '@mui/material';

export default function PageHeader({ icon, title, subtitle, action }) {
  return (
    <Box sx={{
      display:'flex', alignItems:{ xs:'flex-start', sm:'center' },
      flexDirection:{ xs:'row', sm:'row' },
      justifyContent:'space-between', mb:{ xs:2, sm:2.5 }, gap:1.5,
    }}>
      <Box sx={{ display:'flex', alignItems:'center', gap:1.25, minWidth:0 }}>
        <Box sx={{
          width:{ xs:38, sm:44 }, height:{ xs:38, sm:44 }, borderRadius:{ xs:2, sm:2.5 },
          background:'linear-gradient(135deg,#00e676 0%,#651fff 100%)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:{ xs:20, sm:24 }, flexShrink:0,
          boxShadow:'0 4px 16px rgba(0,230,118,0.25)',
        }}>
          {icon}
        </Box>
        <Box sx={{ minWidth:0 }}>
          <Typography variant="h6" sx={{ lineHeight:1.2, fontSize:{ xs:'1rem', sm:'1.2rem' }, fontWeight:800 }} noWrap>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary" sx={{ fontSize:{ xs:10, sm:11 } }} noWrap>
              {subtitle}
            </Typography>
          )}
        </Box>
      </Box>
      {action && <Box sx={{ flexShrink:0 }}>{action}</Box>}
    </Box>
  );
}
