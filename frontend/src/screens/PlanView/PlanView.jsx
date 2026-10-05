import {
  useState, useEffect, useCallback, useRef,
} from 'react';
import { useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import { Helmet } from 'react-helmet-async';

import Connections, { ApiEndpoints } from '@/components/connections/Connections';
import MarkdownRenderer from '@/components/MarkdownRenderer/MarkdownRenderer';
import CopyAllButton from '@/components/CopyAllButton/CopyAllButton';
import { selectContents } from '@/helpers/clipboard';

const PlanView = () => {
  const { planId } = useParams();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const contentRef = useRef(null);

  const fetchPlan = useCallback(async () => {
    setLoading(true);
    const result = await Connections.postRequest(ApiEndpoints.plansGet, { _id: planId });
    if (result?.ok && result.data?.plan) {
      setPlan(result.data.plan);
    }
    setLoading(false);
  }, [planId]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  if (loading) {
    return (
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', bgcolor: '#2B2B2B',
      }}
      >
        <CircularProgress sx={{ color: '#6897BB' }} />
      </Box>
    );
  }

  if (!plan) {
    return (
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', bgcolor: '#2B2B2B',
      }}
      >
        <Typography sx={{ color: '#808080' }}>Plan not found.</Typography>
      </Box>
    );
  }

  return (
    <>
      <Helmet>
        <title>{plan.title || 'Plan'} — Claude IDE</title>
      </Helmet>

      {/* Title and Copy stay in reach while scrolling a long plan */}
      <Box sx={{
        position: 'sticky',
        top: 0,
        zIndex: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: { xs: 1.5, sm: 4 },
        py: 1,
        bgcolor: '#1E1F21',
        borderBottom: '1px solid #3C3F41',
      }}
      >
        <Typography sx={{
          flex: 1,
          minWidth: 0,
          fontSize: '0.95rem',
          fontWeight: 600,
          color: '#D6DCE3',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        >
          {plan.title || 'Plan'}
        </Typography>
        <CopyAllButton text={plan.content} onFail={() => selectContents(contentRef.current)} />
      </Box>
      <Box
        ref={contentRef}
        sx={{
          bgcolor: '#2B2B2B', minHeight: '100vh', overflow: 'auto', px: { xs: 1.5, sm: 4 }, py: 3,
        }}
      >
        <MarkdownRenderer
          content={plan.content}
          fontSize="0.9rem"
          sx={{
            '& h1': { fontSize: '1.5rem' },
            '& h2': { fontSize: '1.25rem' },
            '& h3': { fontSize: '1.05rem' },
          }}
        />
      </Box>
    </>
  );
};

export default PlanView;
