import React, { useState } from 'react';
import CandidateCommunicationPage from './Pages/CandidateCommunicationPage';
import './App.css';

function App() {
  const [currentPage, setCurrentPage] = useState('candidate-communication');

  return (
    <div className="app-container">
      {currentPage === 'candidate-communication' && (
        <CandidateCommunicationPage />
      )}
    </div>
  );
}

export default App;
