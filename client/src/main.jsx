import React from "react";
import ReactDOM from "react-dom/client";
import { AuthProvider } from "./auth/AuthContext.jsx";
import App from "./App.jsx";
import "./styles/base.css";
import "./styles/forms.css";
import "./styles/layout.css";
import "./styles/tables.css";
import "./styles/modals.css";
import "./styles/responsive.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
