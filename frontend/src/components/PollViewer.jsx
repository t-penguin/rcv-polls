import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { API_URL } from "../shared";
import "./PollViewerStyles.css";

const PollViewer = ({ user }) => {
  const navigate = useNavigate();
  const [polls, setPolls] = useState([]);
  const [filteredPolls, setFilteredPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  // Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      navigate("/login");
    }
  }, [user, navigate]);

  // Fetch polls
  useEffect(() => {
    const fetchPolls = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${API_URL}/api/polls`, {
          params: { creatorId: user?.id },
          withCredentials: true,
        });
        setPolls(response.data);
      } catch (error) {
        setError("Failed to load polls");
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchPolls();
    }
  }, [user]);

  // Filter and sort polls
  useEffect(() => {
    let filtered = [...polls];

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter((poll) => poll.status === statusFilter);
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (poll) =>
          poll.title.toLowerCase().includes(term) ||
          (poll.description && poll.description.toLowerCase().includes(term))
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.createdAt) - new Date(a.createdAt);
        case "oldest":
          return new Date(a.createdAt) - new Date(b.createdAt);
        case "title":
          return a.title.localeCompare(b.title);
        case "status":
          return a.status.localeCompare(b.status);
        default:
          return 0;
      }
    });

    setFilteredPolls(filtered);
  }, [polls, searchTerm, statusFilter, sortBy]);

  const copyShareableLink = (shareableLink) => {
    const link = `${window.location.origin}/vote/${shareableLink}`;
    navigator.clipboard.writeText(link);
    // You could add a toast notification here
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className="poll-viewer-container">
        <div className="loading">Loading your polls...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="poll-viewer-container">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  return (
    <div className="poll-viewer-container">
      <div className="poll-viewer-header">
        <h1>My Polls</h1>
        <Link to="/polls/create" className="create-button">
          + Create New Poll
        </Link>
      </div>

      <div className="filters-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search polls by title or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filters-row">
          <div className="filter-group">
            <label htmlFor="status-filter">Filter by Status:</label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="sort-by">Sort by:</label>
            <select
              id="sort-by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="filter-select"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="title">Title (A-Z)</option>
              <option value="status">Status</option>
            </select>
          </div>
        </div>
      </div>

      {filteredPolls.length === 0 ? (
        <div className="empty-state">
          {polls.length === 0 ? (
            <>
              <h2>No polls yet</h2>
              <p>Create your first poll to get started!</p>
              <Link to="/polls/create" className="create-button">
                + Create New Poll
              </Link>
            </>
          ) : (
            <>
              <h2>No polls match your filters</h2>
              <p>Try adjusting your search or filter criteria.</p>
            </>
          )}
        </div>
      ) : (
        <div className="polls-grid">
          {filteredPolls.map((poll) => (
            <div key={poll.id} className="poll-card">
              <div className="poll-card-header">
                <div className={`poll-status-badge status-${poll.status}`}>
                  {poll.status.toUpperCase()}
                </div>
                <div className="poll-card-actions">
                  <Link to={`/polls/${poll.id}`} className="edit-link">
                    Edit
                  </Link>
                  {poll.status === "open" && (
                    <button
                      className="copy-link-button"
                      onClick={() => copyShareableLink(poll.shareableLink)}
                      title="Copy shareable link"
                    >
                      🔗
                    </button>
                  )}
                </div>
              </div>

              <h3 className="poll-card-title">{poll.title}</h3>
              
              {poll.description && (
                <p className="poll-card-description">{poll.description}</p>
              )}

              <div className="poll-card-meta">
                <div className="meta-item">
                  <span className="meta-label">Options:</span>
                  <span className="meta-value">{poll.options?.length || 0}</span>
                </div>
                {poll.maxRankings && (
                  <div className="meta-item">
                    <span className="meta-label">Max Rankings:</span>
                    <span className="meta-value">{poll.maxRankings}</span>
                  </div>
                )}
                {poll.allowAnonymous && (
                  <div className="meta-item">
                    <span className="meta-badge">Anonymous Allowed</span>
                  </div>
                )}
              </div>

              <div className="poll-card-footer">
                <div className="poll-dates">
                  <div className="date-item">
                    <span className="date-label">Created:</span>
                    <span className="date-value">{formatDate(poll.createdAt)}</span>
                  </div>
                  {poll.closedAt && (
                    <div className="date-item">
                      <span className="date-label">Closed:</span>
                      <span className="date-value">{formatDate(poll.closedAt)}</span>
                    </div>
                  )}
                  {poll.expiresAt && (
                    <div className="date-item">
                      <span className="date-label">Expires:</span>
                      <span className="date-value">{formatDate(poll.expiresAt)}</span>
                    </div>
                  )}
                </div>

                {poll.status === "open" && (
                  <Link
                    to={`/vote/${poll.shareableLink}`}
                    className="view-poll-link"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View Poll →
                  </Link>
                )}
                {poll.status === "closed" && (
                  <span className="closed-label">Poll Closed</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredPolls.length > 0 && (
        <div className="polls-count">
          Showing {filteredPolls.length} of {polls.length} poll{polls.length !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
};

export default PollViewer;

