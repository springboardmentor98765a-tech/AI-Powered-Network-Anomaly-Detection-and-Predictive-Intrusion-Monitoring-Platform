import { useEffect, useState } from "react";
import api from "../api/api";

export default function Roles() {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState({});
  const [counts, setCounts] = useState({});
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        // Run the three requests at the same time
        const [rolesRes, permRes, usersRes] = await Promise.all([
          api.get("/roles"),
          api.get("/roles/permissions"),
          api.get("/users", { params: { limit: 100 } }),
        ]);

        setRoles(rolesRes.data);
        setPermissions(permRes.data);

        // Count how many users have each role
        const tally = {};
        usersRes.data.forEach((u) =>
          u.roles.forEach((r) => {
            tally[r.role_name] = (tally[r.role_name] || 0) + 1;
          })
        );
        setCounts(tally);
      } catch (err) {
        setError("Unable to load roles. Please try again.");
      }
    };
    load();
  }, []);

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Roles & Permissions</h2>
      <p style={styles.note}>
        Review what each role is allowed to do. To change a person's role, use the
        User Management page.
      </p>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.grid}>
        {roles.map((role) => (
          <div key={role.id} style={styles.card}>
            <h3 style={styles.cardTitle}>
              {role.role_name.replace("_", " ")}
            </h3>
            <p style={styles.description}>{role.description}</p>
            <p style={styles.count}>
              Users with this role: <strong style={{ color: "#FFFFFF" }}>{counts[role.role_name] || 0}</strong>
            </p>

            <h4 style={styles.subTitle}>Permitted actions</h4>
            <ul style={styles.list}>
              {(permissions[role.role_name] || []).map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  note: { color: "#AFC4E5", marginTop: 0 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 16,
    maxWidth: 1000,
  },
  card: {
    background: "#0D2045",
    border: "1px solid #1B3566",
    color: "#E5ECF8",
    padding: 20,
    borderRadius: 10,
    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
  },
  cardTitle: { marginTop: 0, color: "#20C5F5", textTransform: "capitalize" },
  description: { color: "#AFC4E5" },
  count: { fontSize: 14, color: "#AFC4E5" },
  subTitle: { marginBottom: 6, color: "#FFFFFF" },
  list: { margin: 0, paddingLeft: 20, lineHeight: 1.7, fontSize: 14 },
  error: {
    background: "#3B1219",
    color: "#FCA5A5",
    border: "1px solid #7F1D1D",
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
  },
};