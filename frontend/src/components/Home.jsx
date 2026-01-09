import React from "react";
import { Link } from "react-router-dom";
import "./HomeStyles.css";

const Home = ({ user }) => {
  return (
    <div className="home">
      <h1>Welcome to Ranked Choice Voting</h1>
      <p>Create polls, collect votes, and see results using instant runoff voting.</p>
      
      {user ? (
        <div className="home-actions">
          <Link to="/polls" className="primary-button">
            View My Polls
          </Link>
          <Link to="/polls/create" className="secondary-button">
            Create New Poll
          </Link>
        </div>
      ) : (
        <div className="home-actions">
          <Link to="/login" className="primary-button">
            Login
          </Link>
          <Link to="/signup" className="secondary-button">
            Sign Up
          </Link>
        </div>
      )}
    </div>
  );
};

export default Home;
