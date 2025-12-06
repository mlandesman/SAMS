/**
 * ExpandableCard - Full-width card with expand/collapse details
 * For showing lists like past due units, water bills details, etc.
 */
import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Collapse,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Divider,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';

const ExpandableCard = ({ 
  icon: Icon, 
  title, 
  value, 
  subtitle, 
  color = '#dc2626',
  loading = false,
  error = null,
  details = [], // Array of { id, label, value, sublabel }
  emptyMessage = 'No items',
  alertMessage,
  alertSeverity = 'warning',
  children,
}) => {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = details && details.length > 0;

  return (
    <Card 
      sx={{ 
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderRadius: '16px',
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        transition: 'all 0.2s ease',
        overflow: 'hidden',
      }}
    >
      <CardContent sx={{ p: 2, pb: '12px !important' }}>
        {/* Header Row */}
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5}>
          <Box display="flex" alignItems="center">
            {Icon && (
              <Box 
                sx={{ 
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 36,
                  height: 36,
                  borderRadius: '12px',
                  backgroundColor: `${color}15`,
                  mr: 1.5,
                }}
              >
                <Icon sx={{ color, fontSize: 20 }} />
              </Box>
            )}
            <Typography 
              variant="h6" 
              sx={{ 
                fontWeight: 600, 
                color: '#374151',
                fontSize: '0.95rem',
              }}
            >
              {title}
            </Typography>
          </Box>
          
          {hasDetails && !loading && (
            <IconButton
              onClick={() => setExpanded(!expanded)}
              size="small"
              sx={{ 
                color,
                backgroundColor: `${color}10`,
                '&:hover': { backgroundColor: `${color}20` },
              }}
            >
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          )}
        </Box>
        
        {/* Content */}
        {loading ? (
          <Box display="flex" justifyContent="center" py={2}>
            <CircularProgress size={28} sx={{ color }} />
          </Box>
        ) : error ? (
          <Box textAlign="center" py={1}>
            <Typography variant="body2" color="text.secondary">
              {error}
            </Typography>
          </Box>
        ) : (
          <>
            {/* Main Value */}
            <Typography 
              variant="h4" 
              sx={{ 
                color, 
                fontWeight: 700,
                fontSize: '1.75rem',
                mb: 0.5,
              }}
            >
              {value}
            </Typography>
            
            {/* Subtitle */}
            {subtitle && (
              <Typography 
                variant="body2" 
                sx={{ 
                  color: '#6b7280',
                  mb: 1.5,
                }}
              >
                {subtitle}
              </Typography>
            )}
            
            {/* Alert Message */}
            {alertMessage && hasDetails && (
              <Alert severity={alertSeverity} sx={{ mb: 1, py: 0.5 }}>
                {alertMessage}
              </Alert>
            )}
            
            {/* Expandable Details */}
            <Collapse in={expanded}>
              <Box sx={{ mt: 1.5 }}>
                {hasDetails ? (
                  <List 
                    dense 
                    sx={{ 
                      bgcolor: `${color}08`, 
                      borderRadius: 2, 
                      p: 0,
                      '& .MuiListItem-root': {
                        py: 0.75,
                        px: 1.5,
                      }
                    }}
                  >
                    {details.map((item, index) => (
                      <React.Fragment key={item.id || index}>
                        <ListItem>
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {item.label}
                                  {item.sublabel && (
                                    <Typography component="span" variant="caption" sx={{ ml: 0.5, color: '#6b7280' }}>
                                      - {item.sublabel}
                                    </Typography>
                                  )}
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 700, color }}>
                                  {item.value}
                                </Typography>
                              </Box>
                            }
                          />
                        </ListItem>
                        {index < details.length - 1 && <Divider />}
                      </React.Fragment>
                    ))}
                  </List>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', textAlign: 'center' }}>
                    {emptyMessage}
                  </Typography>
                )}
              </Box>
            </Collapse>
            
            {/* Custom children */}
            {children}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ExpandableCard;
