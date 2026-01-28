import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  Button,
  Collapse
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';

const INITIAL_DISPLAY_COUNT = 10;

// Color mapping for change types
const typeColors = {
  feat: { bg: '#e8f5e9', color: '#2e7d32', label: 'feat' },
  fix: { bg: '#fff3e0', color: '#ef6c00', label: 'fix' },
  maint: { bg: '#f5f5f5', color: '#616161', label: 'maint' },
  perf: { bg: '#e3f2fd', color: '#1976d2', label: 'perf' },
  other: { bg: '#fafafa', color: '#9e9e9e', label: 'other' }
};

const formatDate = (dateString) => {
  const date = new Date(dateString + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const ChangeTypeChip = ({ type }) => {
  const typeConfig = typeColors[type] || typeColors.other;
  return (
    <Chip
      label={typeConfig.label}
      size="small"
      sx={{
        height: 18,
        fontSize: '0.7rem',
        fontWeight: 600,
        bgcolor: typeConfig.bg,
        color: typeConfig.color,
        mr: 1,
        '& .MuiChip-label': {
          px: 0.75
        }
      }}
    />
  );
};

const IssueBadge = ({ issueNumber }) => (
  <Typography
    component="span"
    sx={{
      fontSize: '0.75rem',
      color: '#1976d2',
      fontWeight: 500,
      ml: 0.5
    }}
  >
    #{issueNumber}
  </Typography>
);

const ChangelogDisplay = () => {
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const fetchChangelog = async () => {
      try {
        setLoading(true);
        const response = await fetch('/changelog.json');
        if (!response.ok) {
          throw new Error('Failed to load changelog');
        }
        const data = await response.json();
        setReleases(data.releases || []);
        setError(null);
      } catch (err) {
        console.error('Error fetching changelog:', err);
        setError('Unable to load recent changes');
      } finally {
        setLoading(false);
      }
    };

    fetchChangelog();

    // Cleanup - no caching needed
    return () => {
      setReleases([]);
    };
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="info" sx={{ my: 2 }}>
        {error}
      </Alert>
    );
  }

  if (releases.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
        No changelog entries available
      </Typography>
    );
  }

  const displayedReleases = showAll ? releases : releases.slice(0, INITIAL_DISPLAY_COUNT);
  const hasMoreReleases = releases.length > INITIAL_DISPLAY_COUNT;

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
        Recent Changes
      </Typography>
      
      <Box
        sx={{
          maxHeight: 250,
          overflowY: 'auto',
          pr: 1,
          '&::-webkit-scrollbar': {
            width: 6
          },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: '#c0c0c0',
            borderRadius: 3
          }
        }}
      >
        {displayedReleases.map((release, index) => (
          <Box key={release.version} sx={{ mb: 2 }}>
            {/* Version Header */}
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 600,
                color: 'text.primary',
                mb: 0.5
              }}
            >
              v{release.version} — {formatDate(release.date)}
            </Typography>
            
            {/* Changes List */}
            <Box component="ul" sx={{ m: 0, pl: 2.5, listStyle: 'disc' }}>
              {release.changes.slice(0, 8).map((change, changeIndex) => (
                <Box
                  component="li"
                  key={changeIndex}
                  sx={{
                    fontSize: '0.875rem',
                    color: 'text.secondary',
                    mb: 0.5,
                    lineHeight: 1.4
                  }}
                >
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap' }}>
                    <ChangeTypeChip type={change.type} />
                    <Typography component="span" sx={{ fontSize: '0.875rem' }}>
                      {change.text}
                    </Typography>
                    {change.issues && change.issues.length > 0 && (
                      <Box component="span" sx={{ ml: 0.5 }}>
                        {change.issues.map((issue, i) => (
                          <IssueBadge key={i} issueNumber={issue} />
                        ))}
                      </Box>
                    )}
                  </Box>
                </Box>
              ))}
              {release.changes.length > 8 && (
                <Box
                  component="li"
                  sx={{
                    fontSize: '0.8rem',
                    color: 'text.disabled',
                    fontStyle: 'italic'
                  }}
                >
                  +{release.changes.length - 8} more changes...
                </Box>
              )}
            </Box>
          </Box>
        ))}
      </Box>

      {/* Show More/Less Button */}
      {hasMoreReleases && (
        <Box sx={{ textAlign: 'center', mt: 1 }}>
          <Button
            size="small"
            onClick={() => setShowAll(!showAll)}
            endIcon={showAll ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{ textTransform: 'none' }}
          >
            {showAll ? 'Show fewer releases' : `Show older releases (${releases.length - INITIAL_DISPLAY_COUNT} more)`}
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default ChangelogDisplay;
