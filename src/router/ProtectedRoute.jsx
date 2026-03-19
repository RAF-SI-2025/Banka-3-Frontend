import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children, requiredRole }) {
  const token = localStorage.getItem("accessToken");
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole) {
    const userRole = localStorage.getItem("userRole");
    if (userRole && userRole !== requiredRole) {
      if (userRole === "client") {
        return <Navigate to="/dashboard" replace />;
      }
      return <Navigate to="/employees" replace />;
    }
  }

  return children;
}
