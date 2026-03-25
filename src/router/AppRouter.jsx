import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import LoginPage from "../pages/LoginPage.jsx";
import AccountsPage from "../pages/AccountsPage.jsx";
import AdminAccountDetailsPage from "../pages/AdminAccountDetailsPage.jsx";
import LoanOverview from "../pages/LoanOverview.jsx";
import EmployeesPage from "../pages/EmployeesPage.jsx";
import EmployeeDetailsPage from "../pages/EmployeeDetailsPage.jsx";
import CreateEmployeePage from "../pages/CreateEmployeePage.jsx";
import EditEmployeePage from "../pages/EditEmployeePage.jsx";
import ChangePasswordPage from "../pages/ChangePasswordPage.jsx";
import RecipientsPage from "../pages/RecipientsPage.jsx";
import PaymentsPage from "../pages/PaymentsPage.jsx";
import CardsPage from "../pages/CardsPage.jsx";
import ProtectedRoute from "./ProtectedRoute.jsx";
import AdminLoansPage from "../pages/AdminLoansPage.jsx";
import LoanApplicationPage from "../pages/LoanApplicationPage.jsx"
import BusinessDetailsPage from "../pages/BusinessDetailsPage.jsx";
import CreateBusinessAccountPage from "../pages/CreateBusinessAccountPage";
import ForgotPasswordPage from "../pages/ForgotPasswordPage.jsx";
import EnterTokenPage from "../pages/EnterTokenPage.jsx";
import AccountDetailsPage from "../pages/AccountDetailsPage.jsx";
import CreateAccountPage from "../pages/CreateAccountPage.jsx";
import ClientDashboardPage from "../pages/ClientDashboardPage.jsx";
import ExchangePage from "../pages/ExchangePage.jsx";
import PaymentPage from "../pages/PaymentPage.jsx";
import OrdersReviewPage from "../pages/OrdersReviewPage.jsx";

export default function AppRouter() {
  return (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" />} />

          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin-loans" element={<ProtectedRoute requiredRole="employee"><AdminLoansPage /></ProtectedRoute>} />
          <Route path="/orders/review" element={<ProtectedRoute requiredRole="employee"><OrdersReviewPage /></ProtectedRoute>} />

          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/enter-token" element={<EnterTokenPage />} />
          <Route path="/reset-password" element={<ChangePasswordPage />} />
          <Route path="/set-password" element={<ChangePasswordPage />} />

          <Route path="/dashboard" element={<ProtectedRoute requiredRole="client"><ClientDashboardPage /></ProtectedRoute>} />

          <Route path="/loan-request" element={<ProtectedRoute requiredRole="client"><LoanApplicationPage /></ProtectedRoute>} />
          <Route path="/accounts" element={<ProtectedRoute requiredRole="client"><AccountsPage /></ProtectedRoute>} />
          <Route path="/loans" element={<ProtectedRoute requiredRole="client"><LoanOverview /></ProtectedRoute>} />
          <Route path="/accounts/create" element={<ProtectedRoute requiredRole="client"><CreateAccountPage /></ProtectedRoute>} />
          <Route path="/admin/accounts/:accountNumber" element={<ProtectedRoute requiredRole="employee"><AdminAccountDetailsPage /></ProtectedRoute>} />
          <Route path="/employees" element={<ProtectedRoute requiredRole="employee"><EmployeesPage /></ProtectedRoute>} />
          <Route path="/employees/create" element={<ProtectedRoute requiredRole="employee"><CreateEmployeePage /></ProtectedRoute>} />
          <Route path="/employees/edit/:id" element={<ProtectedRoute requiredRole="employee"><EditEmployeePage /></ProtectedRoute>} />
          <Route path="/employees/:id" element={<ProtectedRoute requiredRole="employee"><EmployeeDetailsPage /></ProtectedRoute>} />
          <Route path="/recipients" element={<ProtectedRoute requiredRole="client"><RecipientsPage /></ProtectedRoute>} />
          <Route path="/payments" element={<ProtectedRoute requiredRole="client"><PaymentsPage /></ProtectedRoute>} />
          <Route path="/accounts/business/:id" element={<ProtectedRoute><BusinessDetailsPage /></ProtectedRoute>}/>
          <Route path="/cards" element={<ProtectedRoute requiredRole="client"><CardsPage /></ProtectedRoute>} />
          <Route path="/payment" element={<ProtectedRoute requiredRole="client"><PaymentPage /></ProtectedRoute>} />


          <Route path="/accounts/:id" element={<ProtectedRoute requiredRole="client"><AccountDetailsPage /></ProtectedRoute>} />
          <Route path="/exchange" element={<ProtectedRoute requiredRole="client"><ExchangePage /></ProtectedRoute>} />

        </Routes>
      </BrowserRouter>
  );
}
