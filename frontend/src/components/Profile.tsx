import { useState, type SubmitEvent  } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../api";
import "./Profile.css";

type PasswordInputProps = {
  id: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
};

function PasswordInput({ id, placeholder, value, onChange }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="profile-password">
      <input
        id={id}
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        className="profile-password-toggle"
        aria-label="Hold to show password"
        onPointerDown={() => setVisible(true)}
        onPointerUp={() => setVisible(false)}
        onPointerLeave={() => setVisible(false)}
      >
        {visible ? <Eye size={20} /> : <EyeOff size={20} />}
      </button>
    </div>
  );
}

async function errorFrom(response: Response) {
  if (response.status === 403) return new Error("Current password is incorrect.");
  const body = await response.json().catch(() => null);
  return new Error(body?.message ?? "Failed to save changes.");
}

function Profile() {
  const { user, logout, checkAuth } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const email = user?.email ?? "";
  const role = user?.isAdmin ? "Administrator" : "User";

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const nameChanged = fullName.trim() !== user?.fullName;
    const passwordChange = currentPassword !== "" || newPassword !== "";

    if (passwordChange && (!currentPassword || !newPassword)) {
      setMessage("Fill in both password fields.");
      return;
    }
    if (!nameChanged && !passwordChange) {
      setMessage("Nothing to save.");
      return;
    }

    setSaving(true);
    try {
      if (nameChanged) {
        const response = await apiFetch("/api/v1/users/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fullName }),
        });
        if (!response.ok) throw await errorFrom(response);
      }

      if (passwordChange) {
        const response = await apiFetch("/api/v1/users/me/password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: currentPassword, newPassword }),
        });
        if (!response.ok) throw await errorFrom(response);
        setCurrentPassword("");
        setNewPassword("");
      }

      await checkAuth();
      setMessage("Changes saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save changes.");
    } finally {
      setSaving(false);
    }
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

        <h2>Change password</h2>

        <div className="password-fields">
          <div className="profile-field">
            <label htmlFor="currentPassword">CURRENT PASSWORD</label>
            <PasswordInput
              id="currentPassword"
              placeholder="Enter current password"
              value={currentPassword}
              onChange={setCurrentPassword}
            />
          </div>

          <div className="profile-field">
            <label htmlFor="newPassword">NEW PASSWORD</label>
            <PasswordInput
              id="newPassword"
              placeholder="Enter new password"
              value={newPassword}
              onChange={setNewPassword}
            />
          </div>
        </div>

        {message && (
          <p className="profile-message">{message}</p>
        )}

        <div className="profile-actions">
          <button type="submit" className="profile-save-button" disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
      <div className="profile-logout">
        <button type="button" onClick={() => void logout()}>
          Logout
        </button>
      </div>
    </div>
  );
}
export default Profile