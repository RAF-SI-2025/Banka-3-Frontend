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
import ClientDashboardPage from "../pages/ClientDashboardPage.jsx";
import AccountDetailsPage from "../pages/AccountDetailsPage.jsx";
import PlaceholderPage from "../pages/PlaceholderPage.jsx";

import ProtectedRoute from "./ProtectedRoute.jsx";
import Navbar from "../components/layout/Navbar.jsx";
import MainLayout from "../components/layout/MainLayout.jsx";

export default function AppRouter() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Navigate to="/login"/>}/>
                <Route path="/login" element={<LoginPage/>}/>

                <Route element={<MainLayout/>}>
                    <Route path="/dashboard" element={<ProtectedRoute><ClientDashboardPage/></ProtectedRoute>}/>
                    <Route path="/clients" element={<ProtectedRoute><ClientsPage/></ProtectedRoute>}/>
                    <Route path="/clients/:clientId"
                           element={<ProtectedRoute><ClientDetailsPage/></ProtectedRoute>}/>

                    <Route path="/accounts/:id" element={<ProtectedRoute><AccountDetailsPage/></ProtectedRoute>}/>
                    <Route path="/accounts/personal" element={<ProtectedRoute><PlaceholderPage
                        title="Detaljan prikaz ličnog računa"/></ProtectedRoute>}/>
                    <Route path="/accounts/business" element={<ProtectedRoute><PlaceholderPage
                        title="Detaljan prikaz poslovnog računa"/></ProtectedRoute>}/>
                    <Route path="/accounts/create" element={<ProtectedRoute><PlaceholderPage
                        title="Kreiranje tekućeg i deviznog računa"/></ProtectedRoute>}/>
                    <Route path="/accounts/business-flow" element={<ProtectedRoute><PlaceholderPage
                        title="Flow za poslovni račun"/></ProtectedRoute>}/>

                    <Route path="/payments/new" element={<ProtectedRoute><PlaceholderPage
                        title="Novo plaćanje / prenos"/></ProtectedRoute>}/>
                    <Route path="/payments/overview" element={<ProtectedRoute><PlaceholderPage
                        title="Primaoci i pregled plaćanja"/></ProtectedRoute>}/>

                    <Route path="/cards" element={<ProtectedRoute><CardsPage/></ProtectedRoute>}/>
                    <Route path="/cards/create"
                           element={<ProtectedRoute><PlaceholderPage title="Kreiranje kartice"/></ProtectedRoute>}/>

                    <Route path="/loans/apply" element={<ProtectedRoute><PlaceholderPage
                        title="Podnošenje zahteva za kredit"/></ProtectedRoute>}/>
                    <Route path="/loans/client-view" element={<ProtectedRoute><PlaceholderPage
                        title="Klijentski prikaz kredita"/></ProtectedRoute>}/>
                    <Route path="/loans/manage" element={<ProtectedRoute><PlaceholderPage
                        title="Portal za upravljanje kreditima"/></ProtectedRoute>}/>

                    <Route path="/exchange"
                           element={<ProtectedRoute><PlaceholderPage title="Menjačnica"/></ProtectedRoute>}/>

                    <Route path="/employees" element={<ProtectedRoute><EmployeesPage/></ProtectedRoute>}/>
                    <Route path="/employees/create"
                           element={<ProtectedRoute><CreateEmployeePage/></ProtectedRoute>}/>
                    <Route path="/employees/edit/:id"
                           element={<ProtectedRoute><EditEmployeePage/></ProtectedRoute>}/>
                    <Route path="/employees/:id/change-password"
                           element={<ProtectedRoute><ChangePasswordPage/></ProtectedRoute>}/>
                    <Route path="/employees/:id" element={<ProtectedRoute><EmployeeDetailsPage/></ProtectedRoute>}/>
                    <Route path="/change-password"
                           element={<ProtectedRoute><ChangePasswordPage/></ProtectedRoute>}/>
                </Route>
            </Routes>
        </BrowserRouter>
    );
}