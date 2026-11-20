import { useAuth } from "../context/AuthContext";

// What each role sees on the dashboard
const ROLE_INFO = {
  administrator: {
    title: "Administrator",
    text: "Manage users, roles, teams and platform settings, and review audit logs.",
  },
  security_analyst: {
    title: "Security Analyst",
    text: "Monitor network activity, review alerts and investigate suspicious events.",
  },
  team_lead: {
    title: "Team Lead",
    text: "Oversee your analysts, view team-level dashboards and review incidents.",
  },
};

export default function Dashboard() {
  const { user, roles } = useAuth();

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Welcome, {user.name}</h2>

      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Profile</h3>
        <p>Username: {user.username}</p>
        <p>Email: {user.email}</p>
        <p>Account status: {user.status}</p>
      </div>

      {roles.map((role) =>
        ROLE_INFO[role] ? (
          <div key={role} style={styles.card}>
            <h3 style={styles.cardTitle}>{ROLE_INFO[role].title}</h3>
            <p style={{ color: "#AFC4E5" }}>{ROLE_INFO[role].text}</p>
          </div>
        ) : null
      )}
    </div>
  );
}

const styles = {
  card: {
    background: "#0D2045",
    border: "1px solid #1B3566",
    color: "#E5ECF8",
    padding: 20,
    borderRadius: 10,
    marginBottom: 16,
    maxWidth: 600,
    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
  },
  cardTitle: { marginTop: 0, color: "#20C5F5" },
};