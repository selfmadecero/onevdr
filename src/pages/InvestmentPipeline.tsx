import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Stepper,
  Step,
  StepLabel,
  Button,
  TextField,
  CircularProgress,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../services/firebase';
import {
  collection,
  query,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  arrayUnion,
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import Confetti from 'react-confetti';
import { DataRoomStats, Investor } from '../types';
import {
  analyzeDocuments,
  analyzePotentialInvestorFit,
  generateInvestorInsights,
  analyzeInvestorPortfolio,
  predictInvestmentLikelihood,
  suggestNextActions,
} from '../services/ai';
import { AIInsights } from '../services/ai';

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  marginBottom: theme.spacing(3),
  borderRadius: theme.spacing(3),
  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
  backdropFilter: 'blur(10px)',
  backgroundColor: 'rgba(255, 255, 255, 0.8)',
  transition: 'all 0.3s ease-in-out',
  '&:hover': {
    transform: 'translateY(-5px)',
    boxShadow: '0 15px 40px rgba(0, 0, 0, 0.15)',
  },
}));

const GradientButton = styled(Button)(({ theme }) => ({
  background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
  border: 0,
  borderRadius: theme.spacing(3),
  boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)',
  color: 'white',
  height: 48,
  padding: '0 30px',
}));

const ArcCard = styled(Box)(({ theme }) => ({
  background: 'rgba(255, 255, 255, 0.8)',
  borderRadius: theme.spacing(3),
  padding: theme.spacing(3),
  boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
  backdropFilter: 'blur(4px)',
  border: '1px solid rgba(255, 255, 255, 0.18)',
  transition: 'all 0.3s ease-in-out',
  marginBottom: theme.spacing(2),
  '&:hover': {
    transform: 'translateY(-5px)',
    boxShadow: '0 12px 40px 0 rgba(31, 38, 135, 0.45)',
    background: 'rgba(255, 255, 255, 0.9)',
  },
}));

const steps = [
  'Initial Contact',
  'Pitch Deck Review',
  'First Meeting',
  'Due Diligence',
  'Term Sheet',
  'Negotiation',
  'Closing',
];

const InvestmentPipeline: React.FC = () => {
  const [user] = useAuthState(auth);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [newInvestor, setNewInvestor] = useState<Omit<Investor, 'id'>>({
    name: '',
    company: '',
    email: '',
    phone: '',
    website: '',
    currentStep: 0,
    status: 'active',
    investmentAmount: 0,
    lastContact: '',
    notes: '',
    comments: [],
    industry: '',
    fundSize: 0,
    investmentStage: '',
    location: '',
    importance: 'medium',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingInvestor, setEditingInvestor] = useState<Investor | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(
    null
  );
  const [filterStatus, setFilterStatus] = useState<
    'all' | 'active' | 'paused' | 'closed'
  >('all');
  const [sortBy, setSortBy] = useState<'name' | 'company' | 'investmentAmount'>(
    'name'
  );
  const [expandedCards, setExpandedCards] = useState<{
    [key: string]: boolean;
  }>({});
  const [showConfetti, setShowConfetti] = useState(false);
  const navigate = useNavigate();
  const [aiInsights, setAiInsights] = useState<AIInsights | null>(null);
  const [portfolioAnalysis, setPortfolioAnalysis] = useState<string[]>([]);
  const [investmentLikelihood, setInvestmentLikelihood] = useState<
    number | null
  >(null);
  const [suggestedActions, setSuggestedActions] = useState<string[]>([]);

  const toggleCardExpansion = (investorId: string) => {
    setExpandedCards((prev) => ({
      ...prev,
      [investorId]: !prev[investorId],
    }));
  };

  useEffect(() => {
    if (user) {
      const investorsRef = collection(db, 'users', user.uid, 'investors');
      const q = query(investorsRef);
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const investorList: Investor[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          investorList.push({
            id: doc.id,
            ...data,
            currentStep:
              typeof data.currentStep === 'number' ? data.currentStep : 0,
          } as Investor);
        });
        setInvestors(investorList);
      });
      return unsubscribe;
    }
  }, [user]);

  useEffect(() => {
    const fetchAIInsights = async () => {
      if (investors.length > 0) {
        const insights = await analyzeDocuments(investors);
        setAiInsights(insights);
      }
    };
    fetchAIInsights();
  }, [investors]);

  const handleAddInvestor = async () => {
    if (user) {
      setIsLoading(true);
      try {
        const investorsRef = collection(db, 'users', user.uid, 'investors');
        await addDoc(investorsRef, newInvestor);
        setNewInvestor({
          name: '',
          company: '',
          email: '',
          phone: '',
          website: '',
          currentStep: 0,
          status: 'active',
          investmentAmount: 0,
          lastContact: '',
          notes: '',
          comments: [],
          industry: '',
          fundSize: 0,
          investmentStage: '',
          location: '',
          importance: 'medium',
        });
      } catch (error) {
        console.error('Error adding investor:', error);
        setError('Failed to add investor. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleUpdateInvestorStep = async (
    investorId: string,
    newStep: number
  ) => {
    if (user) {
      const investorRef = doc(db, 'users', user.uid, 'investors', investorId);
      try {
        await updateDoc(investorRef, { currentStep: newStep });
        if (newStep === steps.length - 1) {
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 5000);
        }
      } catch (error) {
        console.error('Error updating investor step:', error);
        setError('Failed to update investor step. Please try again.');
      }
    }
  };

  const handleUpdateInvestorStatus = async (
    investorId: string,
    newStatus: 'active' | 'paused' | 'closed'
  ) => {
    if (user) {
      const investorRef = doc(db, 'users', user.uid, 'investors', investorId);
      try {
        await updateDoc(investorRef, { status: newStatus });
      } catch (error) {
        console.error('Error updating investor status:', error);
        setError('Failed to update investor status. Please try again.');
      }
    }
  };

  const handleDeleteInvestor = async (investorId: string) => {
    if (user) {
      try {
        const investorRef = doc(db, 'users', user.uid, 'investors', investorId);
        await deleteDoc(investorRef);
        setInvestors((prevInvestors) =>
          prevInvestors.filter((investor) => investor.id !== investorId)
        );
      } catch (error) {
        console.error('Error deleting investor:', error);
        setError('Failed to delete investor. Please try again.');
      }
    }
  };

  const handleEditInvestor = async (updatedInvestor: Investor) => {
    if (user) {
      const investorRef = doc(
        db,
        'users',
        user.uid,
        'investors',
        updatedInvestor.id
      );
      try {
        const { id, ...updateData } = updatedInvestor;
        await updateDoc(investorRef, updateData);
        setInvestors((prevInvestors) =>
          prevInvestors.map((investor) =>
            investor.id === updatedInvestor.id ? updatedInvestor : investor
          )
        );
        setEditingInvestor(null);

        // AI 분석 업데이트
        const portfolio = await analyzeInvestorPortfolio(updatedInvestor);
        setPortfolioAnalysis(portfolio);

        const likelihood = await predictInvestmentLikelihood(updatedInvestor, {
          /* 스타트업 정보 */
        });
        setInvestmentLikelihood(likelihood);

        const actions = await suggestNextActions(
          updatedInvestor,
          updatedInvestor.currentStep
        );
        setSuggestedActions(actions);
      } catch (error) {
        console.error('Error updating investor:', error);
        setError('Failed to update investor. Please try again.');
      }
    }
  };

  const handleAddComment = async (investorId: string, commentText: string) => {
    if (user) {
      const investorRef = doc(db, 'users', user.uid, 'investors', investorId);
      try {
        const newComment = {
          id: Date.now().toString(),
          text: commentText,
          date: new Date().toISOString(),
        };

        // Firebase에 코멘트 추가
        await updateDoc(investorRef, {
          comments: arrayUnion(newComment),
        });

        // 로컬 상태 업데이트는 제거
        // Firebase의 onSnapshot 리스너가 자동으로 상태를 업데이트할 것입니다.
      } catch (error) {
        console.error('Error adding comment:', error);
        setError('Failed to add comment. Please try again.');
      }
    }
  };

  const handleUpdateComment = async (
    investorId: string,
    commentId: string,
    newText: string
  ) => {
    if (user) {
      const investorRef = doc(db, 'users', user.uid, 'investors', investorId);
      try {
        const investorDoc = await getDoc(investorRef);
        const currentComments = investorDoc.data()?.comments || [];
        const updatedComments = currentComments.map((comment: any) =>
          comment.id === commentId ? { ...comment, text: newText } : comment
        );
        await updateDoc(investorRef, { comments: updatedComments });
      } catch (error) {
        console.error('Error updating comment:', error);
        setError('Failed to update comment. Please try again.');
      }
    }
  };

  const handleDeleteComment = async (investorId: string, commentId: string) => {
    if (user) {
      const investorRef = doc(db, 'users', user.uid, 'investors', investorId);
      try {
        const investorDoc = await getDoc(investorRef);
        const currentComments = investorDoc.data()?.comments || [];
        const updatedComments = currentComments.filter(
          (comment: any) => comment.id !== commentId
        );
        await updateDoc(investorRef, { comments: updatedComments });
      } catch (error) {
        console.error('Error deleting comment:', error);
        setError('Failed to delete comment. Please try again.');
      }
    }
  };

  const filteredInvestors = investors.filter((investor) =>
    filterStatus === 'all' ? true : investor.status === filterStatus
  );

  const sortedInvestors = filteredInvestors.sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'company') return a.company.localeCompare(b.company);
    if (sortBy === 'investmentAmount')
      return (b.investmentAmount || 0) - (a.investmentAmount || 0);
    return 0;
  });

  const fetchDataRoomStats = async (
    investorId: string
  ): Promise<DataRoomStats> => {
    // 여기에 Firebase 는 API 호출을 통해 데이터룸 통계를 가져오는 로직을 구현합니다.
    // 예시 코드:
    const statsRef = doc(db, 'dataRoomStats', investorId);
    const statsDoc = await getDoc(statsRef);
    return statsDoc.data() as DataRoomStats;
  };

  const navigateToDataRoom = (investorId: string) => {
    // 데이터룸 페이지로 이동하는 로직을 구현합니다.
    // 예시 코드:
    navigate(`/data-room/${investorId}`);
  };

  const InvestorCard: React.FC<{
    investor: Investor;
    expanded: boolean;
    onToggleExpand: () => void;
    handleAddComment: (
      investorId: string,
      commentText: string
    ) => Promise<void>;
    handleUpdateComment: (
      investorId: string,
      commentId: string,
      newText: string
    ) => Promise<void>;
    handleDeleteComment: (
      investorId: string,
      commentId: string
    ) => Promise<void>;
  }> = ({
    investor,
    expanded,
    onToggleExpand,
    handleAddComment,
    handleUpdateComment,
    handleDeleteComment,
  }) => {
    const [dataRoomStats, setDataRoomStats] = useState<DataRoomStats | null>(
      null
    );
    const [newComment, setNewComment] = useState('');
    const [editingCommentId, setEditingCommentId] = useState<string | null>(
      null
    );
    const [editingCommentText, setEditingCommentText] = useState('');
    const [investorFit, setInvestorFit] = useState<number | null>(null);
    const [investorInsights, setInvestorInsights] = useState<string | null>(
      null
    );

    const handleCommentSubmit = () => {
      if (newComment.trim()) {
        handleAddComment(investor.id, newComment.trim());
        setNewComment('');
      }
    };

    const handleEditComment = (commentId: string, currentText: string) => {
      setEditingCommentId(commentId);
      setEditingCommentText(currentText);
    };

    const handleSaveEditedComment = () => {
      if (editingCommentId && editingCommentText.trim()) {
        handleUpdateComment(
          investor.id,
          editingCommentId,
          editingCommentText.trim()
        );
        setEditingCommentId(null);
        setEditingCommentText('');
      }
    };

    useEffect(() => {
      if (expanded) {
        fetchDataRoomStats(investor.id).then(setDataRoomStats);
      }
    }, [expanded, investor.id]);

    useEffect(() => {
      const fetchInvestorAnalysis = async () => {
        const fit = await analyzePotentialInvestorFit(investor);
        const insights = await generateInvestorInsights(investor);
        setInvestorFit(fit);
        setInvestorInsights(insights);
      };
      fetchInvestorAnalysis();
    }, [investor]);

    return (
      <ArcCard>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              {investor.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {investor.company}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="body2">
              Investment Amount:{' '}
              <span style={{ fontWeight: 'bold' }}>
                ${investor.investmentAmount?.toLocaleString() || 'N/A'}
              </span>
            </Typography>
            <Chip
              label={investor.status}
              color={
                investor.status === 'active'
                  ? 'success'
                  : investor.status === 'paused'
                  ? 'warning'
                  : 'error'
              }
              sx={{ borderRadius: '16px', mt: 1 }}
            />
            <Chip
              label={`Importance: ${investor.importance}`}
              color={
                investor.importance === 'high'
                  ? 'error'
                  : investor.importance === 'medium'
                  ? 'warning'
                  : 'default'
              }
              sx={{ borderRadius: '16px', ml: 1 }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <GradientButton onClick={onToggleExpand}>
              {expanded ? 'Hide Details' : 'Show Details'}
            </GradientButton>
            <Button onClick={() => setEditingInvestor(investor)} sx={{ ml: 1 }}>
              Edit
            </Button>
            <Button
              color="error"
              onClick={() => setDeleteConfirmation(investor.id)}
              sx={{ ml: 1 }}
            >
              Delete
            </Button>
          </Grid>
          {expanded && (
            <Grid item xs={12}>
              <Box
                sx={{
                  mt: 2,
                  p: 2,
                  backgroundColor: 'rgba(0, 0, 0, 0.03)',
                  borderRadius: '16px',
                }}
              >
                <Typography variant="body2">Email: {investor.email}</Typography>
                <Typography variant="body2">
                  Last Contact: {investor.lastContact || 'N/A'}
                </Typography>
                <Typography variant="body2">
                  Notes: {investor.notes || 'N/A'}
                </Typography>
                <Stepper
                  activeStep={investor.currentStep || 0}
                  alternativeLabel
                  sx={{ mt: 2 }}
                >
                  {steps.map((label) => (
                    <Step key={label}>
                      <StepLabel>{label}</StepLabel>
                    </Step>
                  ))}
                </Stepper>
                <Box
                  sx={{
                    mt: 2,
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <Button
                    variant="outlined"
                    onClick={() => {
                      if (investor.currentStep > 0) {
                        handleUpdateInvestorStep(
                          investor.id,
                          investor.currentStep - 1
                        );
                      }
                    }}
                    disabled={investor.currentStep === 0}
                  >
                    Previous Step
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      if (investor.currentStep < steps.length - 1) {
                        handleUpdateInvestorStep(
                          investor.id,
                          investor.currentStep + 1
                        );
                      }
                    }}
                    disabled={investor.currentStep === steps.length - 1}
                  >
                    Next Step
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() =>
                      handleUpdateInvestorStatus(
                        investor.id,
                        investor.status === 'active' ? 'paused' : 'active'
                      )
                    }
                  >
                    {investor.status === 'active' ? 'Pause' : 'Activate'}
                  </Button>
                </Box>
                <Box
                  sx={{
                    mt: 2,
                    p: 2,
                    backgroundColor: 'rgba(0, 0, 0, 0.03)',
                    borderRadius: '16px',
                  }}
                >
                  <Typography variant="h6">Data Room Activity</Typography>
                  {dataRoomStats ? (
                    <>
                      <Typography>
                        Last accessed: {dataRoomStats.lastAccessed}
                      </Typography>
                      <Typography>
                        Documents viewed: {dataRoomStats.documentsViewed}
                      </Typography>
                      <Typography>
                        Time spent: {dataRoomStats.timeSpent} minutes
                      </Typography>
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={() => navigateToDataRoom(investor.id)}
                        sx={{ mt: 1 }}
                      >
                        View Data Room
                      </Button>
                    </>
                  ) : (
                    <Typography>Loading data room statistics...</Typography>
                  )}
                </Box>
                <Box mt={2}>
                  <Typography variant="h6">Comments</Typography>
                  <List>
                    {investor.comments?.map((comment, index) => (
                      <ListItem key={`${comment.id}-${index}`}>
                        {editingCommentId === comment.id ? (
                          <>
                            <TextField
                              fullWidth
                              value={editingCommentText}
                              onChange={(e) =>
                                setEditingCommentText(e.target.value)
                              }
                            />
                            <Button onClick={handleSaveEditedComment}>
                              Save
                            </Button>
                            <Button onClick={() => setEditingCommentId(null)}>
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <ListItemText
                              primary={comment.text}
                              secondary={new Date(
                                comment.date
                              ).toLocaleString()}
                            />
                            <Button
                              onClick={() =>
                                handleEditComment(comment.id, comment.text)
                              }
                            >
                              Edit
                            </Button>
                            <Button
                              onClick={() =>
                                handleDeleteComment(investor.id, comment.id)
                              }
                            >
                              Delete
                            </Button>
                          </>
                        )}
                      </ListItem>
                    ))}
                  </List>
                  <Box display="flex" mt={1}>
                    <TextField
                      fullWidth
                      variant="outlined"
                      size="small"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add a comment..."
                    />
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={handleCommentSubmit}
                      sx={{ ml: 1 }}
                    >
                      Add
                    </Button>
                  </Box>
                </Box>
                {investorFit !== null && (
                  <Typography variant="body2">
                    Investor Fit: {investorFit}%
                  </Typography>
                )}
                {investorInsights && (
                  <Typography variant="body2">
                    AI Insights: {investorInsights}
                  </Typography>
                )}
                {portfolioAnalysis.length > 0 && (
                  <Box>
                    <Typography variant="body2">Portfolio Focus:</Typography>
                    {portfolioAnalysis.map((focus, index) => (
                      <Chip
                        key={index}
                        label={focus}
                        size="small"
                        sx={{ m: 0.5 }}
                      />
                    ))}
                  </Box>
                )}
                {investmentLikelihood !== null && (
                  <Typography variant="body2">
                    Investment Likelihood: {investmentLikelihood}%
                  </Typography>
                )}
                {suggestedActions.length > 0 && (
                  <Box>
                    <Typography variant="body2">
                      Suggested Next Actions:
                    </Typography>
                    <ul>
                      {suggestedActions.map((action, index) => (
                        <li key={index}>{action}</li>
                      ))}
                    </ul>
                  </Box>
                )}
              </Box>
            </Grid>
          )}
        </Grid>
      </ArcCard>
    );
  };

  return (
    <>
      <Box sx={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
        <Typography
          variant="h4"
          gutterBottom
          sx={{ fontWeight: 'bold', color: '#2196F3' }}
        >
          Investment Pipeline
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mt: 2, borderRadius: '16px' }}>
            {error}
          </Alert>
        )}

        <ArcCard sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ color: '#2196F3' }}>
            Add New Investor
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Investor Name"
                value={newInvestor.name}
                onChange={(e) =>
                  setNewInvestor({ ...newInvestor, name: e.target.value })
                }
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Company"
                value={newInvestor.company}
                onChange={(e) =>
                  setNewInvestor({ ...newInvestor, company: e.target.value })
                }
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={newInvestor.email}
                onChange={(e) =>
                  setNewInvestor({ ...newInvestor, email: e.target.value })
                }
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone"
                value={newInvestor.phone}
                onChange={(e) =>
                  setNewInvestor({ ...newInvestor, phone: e.target.value })
                }
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Website"
                value={newInvestor.website}
                onChange={(e) =>
                  setNewInvestor({ ...newInvestor, website: e.target.value })
                }
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Investment Amount"
                type="number"
                value={newInvestor.investmentAmount}
                onChange={(e) =>
                  setNewInvestor({
                    ...newInvestor,
                    investmentAmount: parseFloat(e.target.value) || 0,
                  })
                }
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">$</InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Industry"
                value={newInvestor.industry}
                onChange={(e) =>
                  setNewInvestor({ ...newInvestor, industry: e.target.value })
                }
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Fund Size"
                type="number"
                value={newInvestor.fundSize}
                onChange={(e) =>
                  setNewInvestor({
                    ...newInvestor,
                    fundSize: parseFloat(e.target.value) || 0,
                  })
                }
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">$</InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Investment Stage"
                value={newInvestor.investmentStage}
                onChange={(e) =>
                  setNewInvestor({
                    ...newInvestor,
                    investmentStage: e.target.value,
                  })
                }
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Location"
                value={newInvestor.location}
                onChange={(e) =>
                  setNewInvestor({ ...newInvestor, location: e.target.value })
                }
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Importance</InputLabel>
                <Select
                  value={newInvestor.importance}
                  onChange={(e) =>
                    setNewInvestor({
                      ...newInvestor,
                      importance: e.target.value as 'low' | 'medium' | 'high',
                    })
                  }
                >
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                multiline
                rows={4}
                value={newInvestor.notes}
                onChange={(e) =>
                  setNewInvestor({ ...newInvestor, notes: e.target.value })
                }
              />
            </Grid>
            <Grid item xs={12}>
              <GradientButton
                onClick={handleAddInvestor}
                disabled={
                  isLoading ||
                  !newInvestor.name ||
                  !newInvestor.company ||
                  !newInvestor.email
                }
                fullWidth
              >
                {isLoading ? <CircularProgress size={24} /> : 'Add Investor'}
              </GradientButton>
            </Grid>
          </Grid>
        </ArcCard>

        <ArcCard sx={{ mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Filter by Status</InputLabel>
                <Select
                  value={filterStatus}
                  onChange={(e) =>
                    setFilterStatus(e.target.value as typeof filterStatus)
                  }
                  sx={{ borderRadius: '16px' }}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="paused">Paused</MenuItem>
                  <MenuItem value="closed">Closed</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Sort by</InputLabel>
                <Select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  sx={{ borderRadius: '16px' }}
                >
                  <MenuItem value="name">Name</MenuItem>
                  <MenuItem value="company">Company</MenuItem>
                  <MenuItem value="investmentAmount">
                    Investment Amount
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </ArcCard>

        {sortedInvestors.map((investor) => (
          <InvestorCard
            key={investor.id}
            investor={investor}
            expanded={expandedCards[investor.id] || false}
            onToggleExpand={() => toggleCardExpansion(investor.id)}
            handleAddComment={handleAddComment}
            handleUpdateComment={handleUpdateComment}
            handleDeleteComment={handleDeleteComment}
          />
        ))}

        {editingInvestor && (
          <Dialog
            open={!!editingInvestor}
            onClose={() => setEditingInvestor(null)}
            PaperProps={{
              style: {
                borderRadius: '16px',
                padding: '24px',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
              },
            }}
          >
            <DialogTitle sx={{ fontWeight: 'bold', color: '#2196F3' }}>
              Edit Investor
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Investor Name"
                    value={editingInvestor.name}
                    onChange={(e) =>
                      setEditingInvestor({
                        ...editingInvestor,
                        name: e.target.value,
                      })
                    }
                    sx={{ mt: 2 }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Company"
                    value={editingInvestor.company}
                    onChange={(e) =>
                      setEditingInvestor({
                        ...editingInvestor,
                        company: e.target.value,
                      })
                    }
                    sx={{ mt: 2 }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Email"
                    value={editingInvestor.email}
                    onChange={(e) =>
                      setEditingInvestor({
                        ...editingInvestor,
                        email: e.target.value,
                      })
                    }
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Investment Amount"
                    type="number"
                    value={editingInvestor.investmentAmount}
                    onChange={(e) =>
                      setEditingInvestor({
                        ...editingInvestor,
                        investmentAmount: parseFloat(e.target.value) || 0,
                      })
                    }
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">$</InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Last Contact"
                    type="date"
                    value={editingInvestor.lastContact}
                    onChange={(e) =>
                      setEditingInvestor({
                        ...editingInvestor,
                        lastContact: e.target.value,
                      })
                    }
                    InputLabelProps={{
                      shrink: true,
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Industry"
                    value={editingInvestor.industry}
                    onChange={(e) =>
                      setEditingInvestor({
                        ...editingInvestor,
                        industry: e.target.value,
                      })
                    }
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Fund Size"
                    type="number"
                    value={editingInvestor.fundSize}
                    onChange={(e) =>
                      setEditingInvestor({
                        ...editingInvestor,
                        fundSize: parseFloat(e.target.value) || 0,
                      })
                    }
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">$</InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Investment Stage"
                    value={editingInvestor.investmentStage}
                    onChange={(e) =>
                      setEditingInvestor({
                        ...editingInvestor,
                        investmentStage: e.target.value,
                      })
                    }
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Location"
                    value={editingInvestor.location}
                    onChange={(e) =>
                      setEditingInvestor({
                        ...editingInvestor,
                        location: e.target.value,
                      })
                    }
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Importance</InputLabel>
                    <Select
                      value={editingInvestor.importance}
                      onChange={(e) =>
                        setEditingInvestor({
                          ...editingInvestor,
                          importance: e.target.value as
                            | 'low'
                            | 'medium'
                            | 'high',
                        })
                      }
                    >
                      <MenuItem value="low">Low</MenuItem>
                      <MenuItem value="medium">Medium</MenuItem>
                      <MenuItem value="high">High</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Notes"
                    multiline
                    rows={4}
                    value={editingInvestor.notes}
                    onChange={(e) =>
                      setEditingInvestor({
                        ...editingInvestor,
                        notes: e.target.value,
                      })
                    }
                  />
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions
              sx={{ justifyContent: 'space-between', px: 3, pb: 3 }}
            >
              <Button
                onClick={() => setEditingInvestor(null)}
                sx={{
                  color: '#9e9e9e',
                  '&:hover': { backgroundColor: 'rgba(158, 158, 158, 0.1)' },
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleEditInvestor(editingInvestor)}
                variant="contained"
                sx={{
                  background:
                    'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                  color: 'white',
                  boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)',
                }}
              >
                Save
              </Button>
            </DialogActions>
          </Dialog>
        )}

        <Dialog
          open={!!deleteConfirmation}
          onClose={() => setDeleteConfirmation(null)}
        >
          <DialogTitle>Confirm Deletion</DialogTitle>
          <DialogContent>
            Are you sure you want to delete this investor?
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteConfirmation(null)}>Cancel</Button>
            <Button
              color="error"
              onClick={() => {
                if (deleteConfirmation) {
                  handleDeleteInvestor(deleteConfirmation);
                  setDeleteConfirmation(null);
                }
              }}
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
      {showConfetti && (
        <Confetti
          width={window.innerWidth}
          height={window.innerHeight}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            zIndex: 9999,
            pointerEvents: 'none',
          }}
        />
      )}
    </>
  );
};

export default InvestmentPipeline;
