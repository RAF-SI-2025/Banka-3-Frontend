import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import LoginPage from "../pages/LoginPage.jsx";
import AccountsPage from "../pages/AccountsPage.jsx";
import AdminAccountDetailsPage from "../pages/AdminAccountDetailsPage.jsx";
import LoansPage from "../pages/LoansPage.jsx";
import EmployeeLoansListPage from "../pages/EmployeeLoansListPage.jsx";
import EmployeesPage from "../pages/EmployeesPage.jsx";
import ClientsPage from "../pages/ClientsPage.jsx";
import ClientDetailsPage from "../pages/ClientDetailsPage.jsx";
import EmployeeDetailsPage from "../pages/EmployeeDetailsPage.jsx";
import CreateEmployeePage from "../pages/CreateEmployeePage.jsx";
import CreateClientPage from "../pages/CreateClientPage.jsx";
import EditEmployeePage from "../pages/EditEmployeePage.jsx";
import ChangePasswordPage from "../pages/ChangePasswordPage.jsx";
import RecipientsPage from "../pages/RecipientsPage.jsx";
import PaymentsPage from "../pages/PaymentsPage.jsx";
import CardsPage from "../pages/CardsPage.jsx";
import ProtectedRoute from "./ProtectedRoute.jsx";
import EmployeeLoansPage from "../pages/EmployeeLoansPage.jsx";
import LoanApplicationPage from "../pages/LoanApplicationPage.jsx";
import BusinessDetailsPage from "../pages/BusinessDetailsPage.jsx";
import ForgotPasswordPage from "../pages/ForgotPasswordPage.jsx";
import EnterTokenPage from "../pages/EnterTokenPage.jsx";
import AccountDetailsPage from "../pages/AccountDetailsPage.jsx";
import CreateAccountPage from "../pages/CreateAccountPage.jsx";
import ClientDashboardPage from "../pages/ClientDashboardPage.jsx";
import ExchangePage from "../pages/ExchangePage.jsx";
import BerzaPage from "../pages/BerzaPage.jsx";
import PaymentPage from "../pages/PaymentPage.jsx";
import TotpSetupPage from "../pages/TotpSetupPage.jsx";
import TransferPage from "../pages/TransferPage.jsx";
import EditClientPage from "../pages/EditClientPage.jsx";

export default function AppRouter() {
  return (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" />} />

          <Route path="/login" element={<LoginPage />} />

          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/enter-token" element={<EnterTokenPage />} />
          <Route path="/reset-password" element={<ChangePasswordPage />} />
          <Route path="/set-password" element={<ChangePasswordPage />} />

          <Route path="/dashboard" element={<ProtectedRoute requiredRole="client"><ClientDashboardPage /></ProtectedRoute>} />

          <Route path="/accounts" element={<ProtectedRoute requiredRole="client"><AccountsPage /></ProtectedRoute>} />
          <Route path="/accounts/create" element={<ProtectedRoute requiredRole="employee"><CreateAccountPage /></ProtectedRoute>} />
          <Route path="/admin/accounts" element={<ProtectedRoute requiredRole="employee"><AccountsPage /></ProtectedRoute>} />
          <Route path="/admin/accounts/:accountNumber" element={<ProtectedRoute requiredRole="employee"><AdminAccountDetailsPage /></ProtectedRoute>} />
          <Route path="/admin/accounts/business/:accountNumber" element={<ProtectedRoute requiredRole="employee"><AdminAccountDetailsPage /></ProtectedRoute>} />
          <Route path="/employees" element={<ProtectedRoute requiredRole="employee"><EmployeesPage /></ProtectedRoute>} />

          <Route path="/clients" element={<ProtectedRoute requiredRole="employee"><ClientsPage /></ProtectedRoute>} />
          <Route path="/clients/create" element={<ProtectedRoute requiredRole="employee"><CreateClientPage /></ProtectedRoute>} />
          <Route path="/clients/:id" element={<ProtectedRoute requiredRole="employee"><ClientDetailsPage /></ProtectedRoute>} />
          <Route path="/clients/edit/:id" element={<ProtectedRoute requiredRole="employee" requiredPermission="admin"><EditClientPage/></ProtectedRoute>}/>

          <Route path="/employees/create" element={<ProtectedRoute requiredRole="employee" requiredPermission="admin"><CreateEmployeePage /></ProtectedRoute>}/>
          <Route path="/employees/edit/:id" element={<ProtectedRoute requiredRole="employee"><EditEmployeePage /></ProtectedRoute>} />
          <Route path="/employees/:id" element={<ProtectedRoute requiredRole="employee"><EmployeeDetailsPage /></ProtectedRoute>} />
          <Route path="/recipients" element={<ProtectedRoute requiredRole="client"><RecipientsPage /></ProtectedRoute>} />
          <Route path="/payments" element={<ProtectedRoute requiredRole="client"><PaymentsPage /></ProtectedRoute>} />
          <Route path="/accounts/business/:id" element={<ProtectedRoute><BusinessDetailsPage /></ProtectedRoute>}/>
          <Route path="/cards" element={<ProtectedRoute><CardsPage /></ProtectedRoute>} />
          <Route path="/payment" element={<ProtectedRoute requiredRole="client"><PaymentPage /></ProtectedRoute>} />
          <Route path="/verify" element={<ProtectedRoute requiredRole="client"><TotpSetupPage /></ProtectedRoute>} />
          <Route path="/transfer" element={<ProtectedRoute requiredRole="client"><TransferPage /></ProtectedRoute>} />

          <Route path="/accounts/:accountNumber" element={<ProtectedRoute requiredRole="client"><AccountDetailsPage /></ProtectedRoute>} />
          <Route path="/exchange" element={<ProtectedRoute requiredRole="client"><ExchangePage /></ProtectedRoute>} />
          <Route path="/berza" element={<ProtectedRoute requiredRole="employee"><BerzaPage /></ProtectedRoute>} />

          <Route path="/loans" element={<ProtectedRoute requiredRole="client"><LoansPage /></ProtectedRoute>} />
          <Route path="/loan-request" element={<ProtectedRoute requiredRole="client"><LoanApplicationPage /></ProtectedRoute>} />
          <Route path="/employee-loans" element={<ProtectedRoute requiredRole="employee"><EmployeeLoansPage /></ProtectedRoute>} />
          <Route path="/employee-loans-list" element={<ProtectedRoute requiredRole="employee"><EmployeeLoansListPage /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
  );
}