import Navbar from "./Navbar.jsx";
import { Outlet } from "react-router-dom";
import "./MainLayout.css";

const MainLayout = () => {
    return (
        <div className="main-layout">
            <Navbar />
            <main className="main-layout-content">
                <Outlet />
            </main>
        </div>
    );
};

export default MainLayout;