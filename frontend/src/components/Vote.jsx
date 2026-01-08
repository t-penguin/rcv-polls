import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { API_URL } from "../shared";
import "./VoteStyles.css";

const Vote = ({ user }) => {
  const { shareableLink } = useParams();
  const navigate = useNavigate();
  
  const [poll, setPoll] = useState(null);
  const [availableOptions, setAvailableOptions] = useState([]);
  const [ballot, setBallot] = useState([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [existingBallot, setExistingBallot] = useState(null);
  const [guestId, setGuestId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Get or create guestId from localStorage
  useEffect(() => {
    if (!user) {
      const storedGuestId = localStorage.getItem("guestId");
      if (storedGuestId) {
        setGuestId(storedGuestId);
      } else {
        const newGuestId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem("guestId", newGuestId);
        setGuestId(newGuestId);
      }
    }
  }, [user]);

  // Fetch poll data
  useEffect(() => {
    const fetchPoll = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await axios.get(`${API_URL}/api/polls/link/${shareableLink}`);
        const pollData = response.data;
        
        // Check if poll is accessible
        if (pollData.status !== "open") {
          setError(`This poll is ${pollData.status} and not accepting votes.`);
          setPoll(pollData);
          setLoading(false);
          return;
        }

        // Check if poll has expired
        if (pollData.expiresAt && new Date(pollData.expiresAt) < new Date()) {
          setError("This poll has expired and is no longer accepting votes.");
          setPoll(pollData);
          setLoading(false);
          return;
        }

        // Check authentication requirement
        if (!pollData.allowAnonymous && !user) {
          setError("This poll requires authentication. Please log in to vote.");
          setPoll(pollData);
          setLoading(false);
          return;
        }

        setPoll(pollData);
        setAvailableOptions([...pollData.options]);

        // Check if user has already voted
        const ballotUrl = `${API_URL}/api/polls/${pollData.id}/ballot`;
        const ballotParams = {};
        
        if (!user && guestId) {
          ballotParams.guestId = guestId;
        }

        try {
          const ballotResponse = await axios.get(ballotUrl, {
            params: ballotParams,
            withCredentials: true,
          });

          if (ballotResponse.data.hasVoted) {
            setHasVoted(true);
            setExistingBallot(ballotResponse.data.ballot);
          }
        } catch (err) {
          // No existing ballot, user can vote
        }
      } catch (err) {
        if (err.response?.status === 404) {
          setError("Poll not found. Please check the link and try again.");
        } else {
          setError("Failed to load poll. Please try again later.");
        }
      } finally {
        setLoading(false);
      }
    };

    if (shareableLink) {
      fetchPoll();
    }
  }, [shareableLink, user, guestId]);

  // Add option to ballot
  const addToBallot = (option) => {
    if (!poll || hasVoted) return;

    // Check maxRankings
    if (poll.maxRankings && ballot.length >= poll.maxRankings) {
      setError(`Maximum ${poll.maxRankings} rankings allowed.`);
      return;
    }

    // Check if already in ballot
    if (ballot.some((b) => b.pollOptionId === option.id)) {
      return;
    }

    const newRank = ballot.length + 1;
    const newBallotItem = {
      pollOptionId: option.id,
      rank: newRank,
      pollOption: option,
    };

    setBallot([...ballot, newBallotItem]);
    setAvailableOptions(availableOptions.filter((opt) => opt.id !== option.id));
    setError(null);
  };

  // Remove option from ballot
  const removeFromBallot = (pollOptionId) => {
    if (!poll || hasVoted) return;

    const itemIndex = ballot.findIndex((b) => b.pollOptionId === pollOptionId);
    if (itemIndex === -1) return;

    const removedItem = ballot[itemIndex];
    const newBallot = ballot.filter((b) => b.pollOptionId !== pollOptionId);
    
    // Renumber remaining items
    const renumberedBallot = newBallot.map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

    setBallot(renumberedBallot);
    setAvailableOptions([...availableOptions, removedItem.pollOption].sort((a, b) => a.order - b.order));
    setError(null);
  };

  // Move item in ballot (drag and drop)
  const moveInBallot = (dragIndex, hoverIndex) => {
    if (!poll || hasVoted) return;

    const newBallot = [...ballot];
    const [removed] = newBallot.splice(dragIndex, 1);
    newBallot.splice(hoverIndex, 0, removed);

    // Renumber all items
    const renumberedBallot = newBallot.map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

    setBallot(renumberedBallot);
    setError(null);
  };

  // Submit ballot
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (ballot.length === 0) {
      setError("Please add at least one option to your ballot.");
      return;
    }

    if (!poll) return;

    setSubmitting(true);
    setError(null);

    try {
      const rankings = ballot.map((item) => ({
        pollOptionId: item.pollOptionId,
        rank: item.rank,
      }));

      const payload = { rankings };
      if (!user && guestId) {
        payload.guestId = guestId;
      }

      const response = await axios.post(
        `${API_URL}/api/polls/${poll.id}/ballot`,
        payload,
        { withCredentials: true }
      );

      // Update guestId if returned
      if (response.data.guestId) {
        localStorage.setItem("guestId", response.data.guestId);
        setGuestId(response.data.guestId);
      }

      setSuccess(true);
      setHasVoted(true);
      setExistingBallot(response.data.ballot);
      setBallot([]);
      setAvailableOptions([...poll.options]);
    } catch (err) {
      if (err.response?.status === 409) {
        setError("You have already voted in this poll.");
        setHasVoted(true);
        // Fetch existing ballot
        const ballotResponse = await axios.get(`${API_URL}/api/polls/${poll.id}/ballot`, {
          params: !user && guestId ? { guestId } : {},
          withCredentials: true,
        });
        if (ballotResponse.data.hasVoted) {
          setExistingBallot(ballotResponse.data.ballot);
        }
      } else if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError("Failed to submit ballot. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="vote-container">
        <div className="loading">Loading poll...</div>
      </div>
    );
  }

  if (!poll) {
    return (
      <div className="vote-container">
        <div className="error-message">{error || "Poll not found"}</div>
      </div>
    );
  }

  const isExpired = poll.expiresAt && new Date(poll.expiresAt) < new Date();
  const requiresAuth = !poll.allowAnonymous && !user;
  const canVote = poll.status === "open" && !isExpired && !requiresAuth && !hasVoted;

  return (
    <div className="vote-container">
      <div className="vote-header">
        <h1>{poll.title}</h1>
        {poll.description && <p className="poll-description">{poll.description}</p>}
        <div className="poll-meta">
          <span>Created by {poll.creator?.username}</span>
          {poll.maxRankings && (
            <span>• Maximum {poll.maxRankings} rankings</span>
          )}
        </div>
      </div>

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="success-message" role="alert">
          ✓ Your vote has been submitted successfully!
        </div>
      )}

      {hasVoted && existingBallot ? (
        <div className="already-voted">
          <h2>You have already voted in this poll</h2>
          <div className="existing-ballot">
            <h3>Your Rankings:</h3>
            <ul className="ballot-list">
              {existingBallot.rankings
                .sort((a, b) => a.rank - b.rank)
                .map((ranking) => (
                  <li key={ranking.id} className="ballot-item">
                    <span className="rank-number">{ranking.rank}</span>
                    {ranking.pollOption.imageUrl && (
                      <img
                        src={ranking.pollOption.imageUrl}
                        alt={ranking.pollOption.text}
                        className="option-image"
                      />
                    )}
                    <span className="option-text">{ranking.pollOption.text}</span>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      ) : !canVote ? (
        <div className="cannot-vote">
          <p>
            {poll.status !== "open" && `This poll is ${poll.status}.`}
            {isExpired && " This poll has expired."}
            {requiresAuth && " Please log in to vote in this poll."}
          </p>
        </div>
      ) : (
        <div className="voting-interface">
          <div className="voting-grid">
            {/* Available Options */}
            <div className="available-options-section">
              <h2>Available Options</h2>
              <p className="section-hint">
                Click an option to add it to your ballot
              </p>
              {availableOptions.length === 0 ? (
                <p className="empty-message">All options have been added to your ballot</p>
              ) : (
                <div className="options-list">
                  {availableOptions.map((option) => (
                    <div
                      key={option.id}
                      className="option-item"
                      onClick={() => addToBallot(option)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          addToBallot(option);
                        }
                      }}
                    >
                      {option.imageUrl && (
                        <img
                          src={option.imageUrl}
                          alt={option.text}
                          className="option-image"
                        />
                      )}
                      <span className="option-text">{option.text}</span>
                      <span className="add-icon">+</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Ballot */}
            <div className="ballot-section">
              <h2>Your Ballot</h2>
              <p className="section-hint">
                {poll.maxRankings
                  ? `${ballot.length} of ${poll.maxRankings} options ranked`
                  : `${ballot.length} option${ballot.length !== 1 ? "s" : ""} ranked`}
              </p>
              {ballot.length === 0 ? (
                <p className="empty-message">
                  Your ballot is empty. Add options from the left to rank them.
                </p>
              ) : (
                <ul className="ballot-list">
                  {ballot.map((item, index) => (
                    <BallotItem
                      key={item.pollOptionId}
                      item={item}
                      index={index}
                      onRemove={removeFromBallot}
                      onMove={moveInBallot}
                    />
                  ))}
                </ul>
              )}
              <button
                className="submit-button"
                onClick={handleSubmit}
                disabled={ballot.length === 0 || submitting}
              >
                {submitting ? "Submitting..." : "Submit Vote"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Ballot Item Component with drag and drop
const BallotItem = ({ item, index, onRemove, onMove }) => {
  const [isOver, setIsOver] = useState(false);
  const [dragStartIndex, setDragStartIndex] = useState(null);

  const handleDragStart = (e) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
    setDragStartIndex(index);
    e.currentTarget.classList.add("dragging");
  };

  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove("dragging");
    setIsOver(false);
    setDragStartIndex(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    
    if (dragStartIndex !== null && dragStartIndex !== index) {
      setIsOver(true);
    }
  };

  const handleDragLeave = () => {
    setIsOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsOver(false);
    
    const sourceIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
    
    if (!isNaN(sourceIndex) && sourceIndex !== index) {
      onMove(sourceIndex, index);
    }
    
    setDragStartIndex(null);
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    onRemove(item.pollOptionId);
  };

  return (
    <li
      className={`ballot-item ${isOver ? "drag-over" : ""}`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <span className="drag-handle" aria-label="Drag to reorder">⋮⋮</span>
      <span className="rank-number">{item.rank}</span>
      {item.pollOption.imageUrl && (
        <img
          src={item.pollOption.imageUrl}
          alt={item.pollOption.text}
          className="option-image"
        />
      )}
      <span className="option-text">{item.pollOption.text}</span>
      <button
        className="remove-button"
        onClick={handleRemove}
        aria-label="Remove from ballot"
        type="button"
      >
        ×
      </button>
    </li>
  );
};

export default Vote;

