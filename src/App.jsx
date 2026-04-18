import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Upload from './pages/Upload';
import AgentDashboard from './pages/AgentDashboard';
import Chatbot from './pages/Chatbot';
import MyMedicines from './pages/MyMedicines';
import ProtectedRoute from './components/ProtectedRoute';
import DiagnosticsUpload from './pages/DiagnosticsUpload';
import DiagnosticsResult from './pages/DiagnosticsResult';
import DiagnosticsChat from './pages/DiagnosticsChat';
import DoctorSearch from './pages/DoctorSearch';
import SharedJourney from './pages/SharedJourney';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/upload" element={<ProtectedRoute><Upload /></ProtectedRoute>} />
        <Route path="/home" element={<ProtectedRoute><AgentDashboard /></ProtectedRoute>} />
        <Route path="/agent/:journeyId" element={<ProtectedRoute><AgentDashboard /></ProtectedRoute>} />
        <Route path="/chatbot" element={<ProtectedRoute><Chatbot /></ProtectedRoute>} />
        <Route path="/my-medicines" element={<ProtectedRoute><MyMedicines /></ProtectedRoute>} />
        <Route path="/diagnostics" element={<ProtectedRoute><DiagnosticsUpload /></ProtectedRoute>} />
        <Route path="/diagnostics/results" element={<ProtectedRoute><DiagnosticsResult /></ProtectedRoute>} />
        <Route path="/diagnostics/chat" element={<ProtectedRoute><DiagnosticsChat /></ProtectedRoute>} />
        <Route path="/search-doctor" element={<ProtectedRoute><DoctorSearch /></ProtectedRoute>} />
        <Route path="/shared/journey/:code" element={<SharedJourney />} />
      </Routes>
    </Router>
  );
}

export default App;
