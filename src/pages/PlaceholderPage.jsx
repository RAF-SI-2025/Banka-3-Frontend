import "./PlaceholderPage.css";

export default function PlaceholderPage({ title = "Stranica", description }) {
    return (
        <div className="page-bg">
            <img src="/bank-logo.png" alt="logo" className="bank-logo" />
            <img src="/menu-icon.png" alt="menu" className="menu-icon" />

            <div className="content-wrapper">
                <div className="placeholder-card">
                    <h1>{title}</h1>

                    <p>
                        {description ||
                            "Ova funkcionalnost je trenutno u izradi i biće dostupna uskoro."}
                    </p>
                </div>
            </div>
        </div>
    );
}