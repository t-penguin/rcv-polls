import React from "react";
import { Link } from "react-router-dom";
import "./NavBarStyles.css";

const NavBar = ({ user, onLogout }) => {
  return (
    <nav className="navbar">
      <div className="nav-brand">
        <Link to="/">TTP Winter</Link>
      </div>

      <div className="nav-links">
        {user ? (
          <div className="user-section">
            <Link to="/polls" className="nav-link">
              My Polls
            </Link>
            <Link to="/polls/create" className="nav-link">
              Create Poll
            </Link>
            <span className="username">{user.username}</span>
            <button className="logout-btn" onClick={onLogout}>
              Logout
            </button>
          </div>
        ) : (
          <div className="auth-links">
            <Link to="/login" className="nav-link">
              Login
            </Link>
            <Link to="/signup" className="nav-link">
              Sign Up
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
};

export default NavBar;
