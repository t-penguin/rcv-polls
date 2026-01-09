import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_URL } from "../shared";
import "./PollCreatorStyles.css";

const PollCreator = ({ user }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    allowAnonymous: false,
    maxRankings: "",
    expiresAt: "",
  });
  const [options, setOptions] = useState([{ text: "", order: 0 }]);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [publishAction, setPublishAction] = useState(null);

  // Redirect if not authenticated
  React.useEffect(() => {
    if (!user) {
      navigate("/login");
    }
  }, [user, navigate]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = "Title is required";
    } else if (formData.title.length > 200) {
      newErrors.title = "Title must be 200 characters or less";
    }

    const validOptions = options.filter((opt) => opt.text.trim());
    if (validOptions.length < 2) {
      newErrors.options = "At least 2 poll options are required";
    }

    options.forEach((option, index) => {
      if (option.text.trim() && option.text.length > 500) {
        newErrors[`option-${index}`] = "Option text must be 500 characters or less";
      }
    });

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

    // Clear error
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

    // Clear error
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
    setOptions([...options, { text: "", order: options.length }]);
  };

  const removeOption = (index) => {
    if (options.length <= 2) {
      setErrors({ ...errors, options: "At least 2 poll options are required" });
      return;
    }
    const newOptions = options.filter((_, i) => i !== index);
    // Renumber orders
    const renumberedOptions = newOptions.map((opt, i) => ({ ...opt, order: i }));
    setOptions(renumberedOptions);
  };

  const handleSubmit = async (action) => {
    if (!validateForm()) {
      return;
    }

    setPublishAction(action);
    setShowConfirmation(true);
  };

  const confirmSubmit = async () => {
    setShowConfirmation(false);
    setIsLoading(true);
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
        options: validOptions,
      };

      const response = await axios.post(`${API_URL}/api/polls`, payload, {
        withCredentials: true,
      });

      const pollId = response.data.id;

      // If publishing, update status to open
      if (publishAction === "publish") {
        await axios.put(
          `${API_URL}/api/polls/${pollId}`,
          { status: "open" },
          { withCredentials: true }
        );
        navigate(`/polls/${pollId}`);
      } else {
        // Save as draft
        navigate("/polls");
      }
    } catch (error) {
      if (error.response?.data?.error) {
        setErrors({ general: error.response.data.error });
      } else {
        setErrors({ general: "Failed to create poll. Please try again." });
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return null; // Will redirect
  }

  return (
    <div className="poll-creator-container">
      <div className="poll-creator-header">
        <h1>Create New Poll</h1>
        <button className="cancel-button" onClick={() => navigate("/polls")}>
          Cancel
        </button>
      </div>

      {errors.general && (
        <div className="error-message" role="alert">
          {errors.general}
        </div>
      )}

      <form className="poll-creator-form">
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
              placeholder="Enter poll title"
              maxLength={200}
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
              placeholder="Enter poll description (optional)"
              rows={4}
            />
          </div>
        </div>

        <div className="form-section">
          <h2>Options</h2>
          {errors.options && (
            <div className="error-message">{errors.options}</div>
          )}

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
                    placeholder={`Option ${index + 1}`}
                    maxLength={500}
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      className="remove-option-button"
                      onClick={() => removeOption(index)}
                      aria-label="Remove option"
                    >
                      ×
                    </button>
                  )}
                </div>
                {errors[`option-${index}`] && (
                  <span className="error-text">{errors[`option-${index}`]}</span>
                )}
              </div>
            </div>
          ))}

          <button
            type="button"
            className="add-option-button"
            onClick={addOption}
          >
            + Add Option
          </button>
        </div>

        <div className="form-section">
          <h2>Settings</h2>

          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                name="allowAnonymous"
                checked={formData.allowAnonymous}
                onChange={handleInputChange}
              />
              Allow anonymous voting
            </label>
            <span className="hint">Guests can vote without logging in</span>
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
              placeholder="No limit"
              min="1"
            />
            {errors.maxRankings && (
              <span className="error-text">{errors.maxRankings}</span>
            )}
            <span className="hint">Limit how many options voters can rank</span>
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
            />
            {errors.expiresAt && (
              <span className="error-text">{errors.expiresAt}</span>
            )}
            <span className="hint">Poll will automatically close at this time</span>
          </div>
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="draft-button"
            onClick={() => handleSubmit("draft")}
            disabled={isLoading}
          >
            {isLoading ? "Saving..." : "Save as Draft"}
          </button>
          <button
            type="button"
            className="publish-button"
            onClick={() => handleSubmit("publish")}
            disabled={isLoading}
          >
            {isLoading ? "Publishing..." : "Publish Poll"}
          </button>
        </div>
      </form>

      {showConfirmation && (
        <div className="modal-overlay" onClick={() => setShowConfirmation(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>
              {publishAction === "publish"
                ? "Publish Poll?"
                : "Save as Draft?"}
            </h3>
            <p>
              {publishAction === "publish"
                ? "This poll will be published and open for voting immediately."
                : "This poll will be saved as a draft and can be published later."}
            </p>
            <div className="modal-actions">
              <button
                className="cancel-button"
                onClick={() => setShowConfirmation(false)}
              >
                Cancel
              </button>
              <button
                className="confirm-button"
                onClick={confirmSubmit}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PollCreator;

