import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useAuth } from '../auth/AuthContext';

const Challenges = () => {
  const [challenges, setChallenges] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const { token, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/'); // Redirect to login
  };

  // Fetch challenges from the backend
  const fetchChallenges = async () => {
    try {
      if (!token) {
        navigate('/'); // Redirect to login if no token
        return;
      }
      const response = await axios.get(`${API_BASE_URL}/challenges`, {
        headers: { Authorization: token },
      });
      setChallenges(response.data);
    } catch (error) {
      console.error(error);
      const status = error?.response?.status;
      if (status === 401 || status === 403) {
        logout();
        navigate('/');
        return;
      }
      setMessage('Failed to fetch challenges');
    }
  };

  // Create a new challenge
  const handleCreateChallenge = async (e) => {
    e.preventDefault();
    try {
      if (!token) {
        navigate('/'); // Redirect to login if no token
        return;
      }
      await axios.post(
        `${API_BASE_URL}/challenges`,
        { title, description },
        { headers: { Authorization: token } }
      );
      setMessage('Challenge created successfully!');
      fetchChallenges(); // Refresh the list
    } catch (error) {
      const status = error?.response?.status;
      if (status === 401 || status === 403) {
        logout();
        navigate('/');
        return;
      }
      setMessage(error.response?.data?.error || 'An error occurred');
    }
  };

  useEffect(() => {
    fetchChallenges();
  }, [token]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Challenges</h1>
      </div>
      <form onSubmit={handleCreateChallenge}>
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button type="submit">Create Challenge</button>
      </form>
      <p>{message}</p>
      <ul>
        {challenges.map((challenge) => (
          <li key={challenge.id}>
            <h3>{challenge.title}</h3>
            <p>{challenge.description}</p>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Challenges;