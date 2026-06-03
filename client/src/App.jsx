import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import MeshBackground from './components/MeshBackground.jsx';
import Auth from './pages/Auth.jsx';
import Dashboard from './pages/Dashboard.jsx';
import LogRun from './pages/LogRun.jsx';
import RunDetail from './pages/RunDetail.jsx';
import Coach from './pages/Coach.jsx';
import Analytics from './pages/Analytics.jsx';
import RaceVault from './pages/RaceVault.jsx';
import Recovery from './pages/Recovery.jsx';
import TrainingLoad from './pages/TrainingLoad.jsx';
import Achievements from './pages/Achievements.jsx';
import Profile from './pages/Profile.jsx';

function protect(el) {
  return <ProtectedRoute>{el}</ProtectedRoute>;
}

export default function App() {
  return (
    <>
    <MeshBackground />
    <Routes>
      <Route path="/login" element={<Auth />} />
      <Route path="/" element={protect(<Dashboard />)} />
      <Route path="/log" element={protect(<LogRun />)} />
      <Route path="/runs/:id" element={protect(<RunDetail />)} />
      <Route path="/coach" element={protect(<Coach />)} />
      <Route path="/analytics" element={protect(<Analytics />)} />
      <Route path="/vault" element={protect(<RaceVault />)} />
      <Route path="/recovery" element={protect(<Recovery />)} />
      <Route path="/training-load" element={protect(<TrainingLoad />)} />
      <Route path="/achievements" element={protect(<Achievements />)} />
      <Route path="/profile" element={protect(<Profile />)} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
