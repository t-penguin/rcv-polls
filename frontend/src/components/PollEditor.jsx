import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { API_URL } from "../shared";
import "./PollEditorStyles.css";

const PollEditor = ({ user }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [poll, setPoll] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    allowAnonymous: false,
    maxRankings: "",
    expiresAt: "",
    status: "draft",
  });
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
  }, [user, navigate]);

  // Fetch poll data
  useEffect(() => {
    const fetchPoll = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${API_URL}/api/polls/${id}`, {
          withCredentials: true,
        });

        const pollData = response.data;

        // Check if user is the creator
        if (pollData.creatorId !== user?.id) {
          setErrors({ general: "You are not authorized to edit this poll" });
          setLoading(false);
          return;
        }

        setPoll(pollData);
        setFormData({
          title: pollData.title || "",
          description: pollData.description || "",
          allowAnonymous: pollData.allowAnonymous || false,
          maxRankings: pollData.maxRankings?.toString() || "",
          expiresAt: pollData.expiresAt
            ? new Date(pollData.expiresAt).toISOString().slice(0, 16)
            : "",
          status: pollData.status,
        });
        setOptions(
          (pollData.options || []).map((opt) => ({
            id: opt.id,
            text: opt.text,
            order: opt.order,
          }))
        );
      } catch (error) {
        if (error.response?.status === 404) {
          setErrors({ general: "Poll not found" });
        } else {
          setErrors({ general: "Failed to load poll" });
        }
      } finally {
        setLoading(false);
      }
    };

    if (user && id) {
      fetchPoll();
    }
  }, [id, user]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = "Title is required";
    }

    const validOptions = options.filter((opt) => opt.text.trim());
    if (validOptions.length < 2 && (poll?.status === "draft")) {
      newErrors.options = "At least 2 poll options are required";
    }

    if (formData.maxRankings && (isNaN(formData.maxRankings) || parseInt(formData.maxRankings) < 1)) {
      newErrors.maxRankings = "Maximum rankings must be at least 1";
    }

    if (formData.expiresAt && new Date(formData.expiresAt) <= new Date()) {
      newErrors.expiresAt = "Expiration date must be in the future";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index].text = value;
    setOptions(newOptions);

    if (errors[`option-${index}`]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[`option-${index}`];
        return newErrors;
      });
    }
    if (errors.options) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.options;
        return newErrors;
      });
    }
  };

  const addOption = () => {
    setOptions([...options, { text: "", order: options.length, id: null }]);
  };

  const removeOption = (index) => {
    if (options.length <= 2) {
      setErrors({ ...errors, options: "At least 2 poll options are required" });
      return;
    }
    const newOptions = options.filter((_, i) => i !== index);
    const renumberedOptions = newOptions.map((opt, i) => ({ ...opt, order: i }));
    setOptions(renumberedOptions);
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setSaving(true);
    setErrors({});

    try {
      const validOptions = options
        .filter((opt) => opt.text.trim())
        .map((opt, index) => ({
          text: opt.text.trim(),
          order: index,
        }));

      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        allowAnonymous: formData.allowAnonymous,
        maxRankings: formData.maxRankings ? parseInt(formData.maxRankings) : null,
        expiresAt: formData.expiresAt || null,
        options: poll?.status === "draft" ? validOptions : undefined, // Only update options for drafts
      };

      await axios.put(`${API_URL}/api/polls/${id}`, payload, {
        withCredentials: true,
      });

      navigate("/polls");
    } catch (error) {
      if (error.response?.data?.error) {
        setErrors({ general: error.response.data.error });
      } else {
        setErrors({ general: "Failed to update poll" });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleClosePoll = async () => {
    setSaving(true);
    try {
      await axios.put(
        `${API_URL}/api/polls/${id}`,
        { status: "closed" },
        { withCredentials: true }
      );
      navigate("/polls");
    } catch (error) {
      setErrors({ general: "Failed to close poll" });
    } finally {
      setSaving(false);
      setShowCloseModal(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await axios.delete(`${API_URL}/api/polls/${id}`, {
        withCredentials: true,
      });
      navigate("/polls");
    } catch (error) {
      setErrors({ general: "Failed to delete poll" });
      setSaving(false);
      setShowDeleteModal(false);
    }
  };

  const copyShareableLink = () => {
    const link = `${window.location.origin}/vote/${poll?.shareableLink}`;
    navigator.clipboard.writeText(link).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className="poll-editor-container">
        <div className="loading">Loading poll...</div>
      </div>
    );
  }

  if (!poll || errors.general) {
    return (
      <div className="poll-editor-container">
        <div className="error-message">{errors.general || "Poll not found"}</div>
        <button className="back-button" onClick={() => navigate("/polls")}>
          Back to My Polls
        </button>
      </div>
    );
  }

  const canEditOptions = poll.status === "draft";
  const canPublish = poll.status === "draft";
  const canClose = poll.status === "open";

  return (
    <div className="poll-editor-container">
      <div className="poll-editor-header">
        <div>
          <h1>Edit Poll</h1>
          <div className={`poll-status-badge status-${poll.status}`}>
            {poll.status.toUpperCase()}
          </div>
        </div>
        <button className="back-button" onClick={() => navigate("/polls")}>
          ← Back to My Polls
        </button>
      </div>

      {poll.status === "open" && (
        <div className="poll-info-box">
          <h3>Poll is Open</h3>
          <p>This poll is currently accepting votes. Options cannot be edited.</p>
          <div className="shareable-link-section">
            <label>Shareable Link:</label>
            <div className="link-input-group">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}/vote/${poll.shareableLink}`}
                className="link-input"
              />
              <button
                className="copy-button"
                onClick={copyShareableLink}
                disabled={linkCopied}
              >
                {linkCopied ? "✓ Copied" : "Copy Link"}
              </button>
            </div>
          </div>
        </div>
      )}

      {errors.general && (
        <div className="error-message" role="alert">
          {errors.general}
        </div>
      )}

      <div className="poll-editor-form">
        <div className="form-section">
          <h2>Poll Details</h2>

          <div className="form-group">
            <label htmlFor="title">
              Title <span className="required">*</span>
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              className={errors.title ? "error" : ""}
              disabled={!canEditOptions}
            />
            {errors.title && <span className="error-text">{errors.title}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={4}
              disabled={!canEditOptions}
            />
          </div>
        </div>

        {canEditOptions && (
          <div className="form-section">
            <h2>Options</h2>
            {errors.options && <div className="error-message">{errors.options}</div>}

            {options.map((option, index) => (
              <div key={index} className="option-input-group">
                <div className="form-group">
                  <label htmlFor={`option-${index}`}>
                    Option {index + 1}
                    {index < 2 && <span className="required">*</span>}
                  </label>
                  <div className="option-input-row">
                    <input
                      type="text"
                      id={`option-${index}`}
                      value={option.text}
                      onChange={(e) => handleOptionChange(index, e.target.value)}
                      className={errors[`option-${index}`] ? "error" : ""}
                      maxLength={500}
                    />
                    {options.length > 2 && (
                      <button
                        type="button"
                        className="remove-option-button"
                        onClick={() => removeOption(index)}
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            <button type="button" className="add-option-button" onClick={addOption}>
              + Add Option
            </button>
          </div>
        )}

        <div className="form-section">
          <h2>Settings</h2>

          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                name="allowAnonymous"
                checked={formData.allowAnonymous}
                onChange={handleInputChange}
                disabled={!canEditOptions}
              />
              Allow anonymous voting
            </label>
          </div>

          <div className="form-group">
            <label htmlFor="maxRankings">Maximum Rankings (Optional)</label>
            <input
              type="number"
              id="maxRankings"
              name="maxRankings"
              value={formData.maxRankings}
              onChange={handleInputChange}
              className={errors.maxRankings ? "error" : ""}
              disabled={!canEditOptions}
              min="1"
            />
            {errors.maxRankings && (
              <span className="error-text">{errors.maxRankings}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="expiresAt">Expiration Date (Optional)</label>
            <input
              type="datetime-local"
              id="expiresAt"
              name="expiresAt"
              value={formData.expiresAt}
              onChange={handleInputChange}
              className={errors.expiresAt ? "error" : ""}
              disabled={!canEditOptions}
            />
            {errors.expiresAt && (
              <span className="error-text">{errors.expiresAt}</span>
            )}
          </div>
        </div>

        <div className="form-actions">
          {canEditOptions && (
            <button
              className="save-button"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          )}
          {canPublish && (
            <button
              className="publish-button"
              onClick={async () => {
                if (validateForm()) {
                  await handleSave();
                  await axios.put(
                    `${API_URL}/api/polls/${id}`,
                    { status: "open" },
                    { withCredentials: true }
                  );
                  navigate("/polls");
                }
              }}
              disabled={saving}
            >
              Publish Poll
            </button>
          )}
          {canClose && (
            <button
              className="close-button"
              onClick={() => setShowCloseModal(true)}
              disabled={saving}
            >
              Close Poll
            </button>
          )}
          <button
            className="delete-button"
            onClick={() => setShowDeleteModal(true)}
            disabled={saving}
          >
            Delete Poll
          </button>
        </div>
      </div>

      {/* Close Confirmation Modal */}
      {showCloseModal && (
        <div className="modal-overlay" onClick={() => setShowCloseModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Close Poll?</h3>
            <p>This will close the poll and stop accepting new votes. You can view results after closing.</p>
            <div className="modal-actions">
              <button
                className="cancel-button"
                onClick={() => setShowCloseModal(false)}
              >
                Cancel
              </button>
              <button className="confirm-button" onClick={handleClosePoll}>
                Close Poll
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Poll?</h3>
            <p>This action cannot be undone. All votes and data will be permanently deleted.</p>
            <div className="modal-actions">
              <button
                className="cancel-button"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>
              <button className="delete-confirm-button" onClick={handleDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PollEditor;

