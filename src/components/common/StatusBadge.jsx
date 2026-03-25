import "./StatusBadge.css";

const STATUS_CONFIG = {
    Pending: {
        label: "Pending",
        className: "status-badge--pending",
    },
    Approved: {
        label: "Approved",
        className: "status-badge--approved",
    },
    Declined: {
        label: "Declined",
        className: "status-badge--declined",
    },
    Done: {
        label: "Done",
        className: "status-badge--done",
    },
};

function normalizeStatus(status) {
    if (!status) return "Pending";

    const normalized = String(status).trim();

    if (STATUS_CONFIG[normalized]) return normalized;

    const lowered = normalized.toLowerCase();

    if (lowered === "pending") return "Pending";
    if (lowered === "approved") return "Approved";
    if (lowered === "declined") return "Declined";
    if (lowered === "done") return "Done";

    return "Pending";
}

export default function StatusBadge({ status }) {
    const normalizedStatus = normalizeStatus(status);
    const config = STATUS_CONFIG[normalizedStatus];

    return (
        <span className={`status-badge ${config.className}`}>
      {config.label}
    </span>
    );
}