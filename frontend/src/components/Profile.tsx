import { useState, type SubmitEvent  } from "react";
import "./Profile.css";

function Profile() {
  const [fullName, setFullName] = useState("Aleksander Szostak");
  const [email] = useState("aleksander@tm1.edu.pl");
  const [role] = useState("Administrator");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [message, setMessage] = useState("");

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Formularz działa. Zapis wymaga jeszcze połączenia z API.");
  }

  return (
    <div className="profile-page">
      <h1>Your Profile</h1>
      <form className="profile-form" onSubmit={handleSubmit}>
        <div className="profile-field">
          <label htmlFor="fullName">FULL NAME</label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
          />
        </div>

        <div className="profile-readonly-fields">
        <div className="profile-field">
          <label htmlFor="role">ACCOUNT TYPE</label>
          <input
            id="role"
            type="text"
            value={role}
            readOnly
          />
        </div>

        <div className="profile-field">
          <label htmlFor="email">EMAIL ADDRESS</label>
          <input
            id="email"
            type="email"
            value={email}
            readOnly
          />
        </div>
        </div>

        <div className="profile-divider"></div>

        <div className="password-fields">
          <div className="profile-field">
            <label htmlFor="currentPassword">CURRENT PASSWORD</label>
            <input
              id="currentPassword"
              type="password"
              placeholder="Enter current password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </div>

          <div className="profile-field">
            <label htmlFor="newPassword">NEW PASSWORD</label>
            <input
              id="newPassword"
              type="password"
              placeholder="Enter new password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </div>
        </div>

        {message && (
          <p className="profile-message">{message}</p>
        )}

        <div className="profile-actions">
          <button type="submit" className="profile-save-button">
            Save Changes
          </button>
        </div>
      </form>
      <div className="profile-logout">
        <button type="button" onClick={() => {
          // Tu się doda wylogowywanie
        }}>
          Logout
        </button>
      </div>
    </div>
  );
}
export default Profile