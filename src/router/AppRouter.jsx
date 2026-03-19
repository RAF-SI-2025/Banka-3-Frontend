import {BrowserRouter, Routes, Route, Navigate} from "react-router-dom";

import LoginPage from "../pages/LoginPage.jsx";
import EmployeesPage from "../pages/EmployeesPage.jsx";
import EmployeeDetailsPage from "../pages/EmployeeDetailsPage.jsx";
import CreateEmployeePage from "../pages/CreateEmployeePage.jsx";
import EditEmployeePage from "../pages/EditEmployeePage.jsx";
import ChangePasswordPage from "../pages/ChangePasswordPage.jsx";
import CardsPage from "../pages/CardsPage.jsx";
import ClientsPage from "../pages/ClientsPage.jsx";
import ClientDetailsPage from "../pages/ClientDetailsPage.jsx";
import ProtectedRoute from "./ProtectedRoute.jsx";
import BusinessDetailsPage from "../pages/BusinessDetailsPage.jsx";
import AccountDetailsPage from "../pages/AccountDetailsPage.jsx";
import CreateAccountPage from "../pages/CreateAccountPage.jsx";
import ClientDashboardPage from "../pages/ClientDashboardPage.jsx";
import ExchangePage from "../pages/ExchangePage.jsx";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />

        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<ProtectedRoute><ClientDashboardPage /></ProtectedRoute>} />

        <Route path="/accounts/create" element={<ProtectedRoute><CreateAccountPage /></ProtectedRoute>} />
        <Route path="/employees" element={<ProtectedRoute><EmployeesPage /></ProtectedRoute>} />
        <Route path="/employees/create" element={<ProtectedRoute><CreateEmployeePage /></ProtectedRoute>} />
        <Route path="/employees/edit/:id" element={<ProtectedRoute><EditEmployeePage /></ProtectedRoute>} />
        <Route path="/employees/:id/change-password" element={<ProtectedRoute><ChangePasswordPage /></ProtectedRoute>} />
        <Route path="/employees/:id" element={<ProtectedRoute><EmployeeDetailsPage /></ProtectedRoute>} />
        <Route path="/change-password" element={<ProtectedRoute><ChangePasswordPage /></ProtectedRoute>} />
        <Route path="/accounts/business/:id" element={<ProtectedRoute><BusinessDetailsPage /></ProtectedRoute>}/>
        <Route path="/cards" element={<ProtectedRoute><CardsPage /></ProtectedRoute>} />

        <Route path="/accounts/:id" element={<ProtectedRoute><AccountDetailsPage /></ProtectedRoute>} />
        <Route path="/exchange" element={<ProtectedRoute><ExchangePage /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}
