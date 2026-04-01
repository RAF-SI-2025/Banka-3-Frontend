import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getRecipients,
  createRecipient,
  updateRecipient,
  deleteRecipient,
} from "../services/PaymentService";
import MenuDropdown from "../components/MenuDropdown";
import "./RecipientsPage.css";

const EMPTY_FORM = {
  name: "",
  account_number: "",
};

export default function RecipientsPage() {
  const [recipients, setRecipients] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const navigate = useNavigate();

  async function loadRecipients() {
    try {
      setLoading(true);
      const data = await getRecipients();
      setRecipients(Array.isArray(data) ? data : []);
    } catch {
      setRecipients([]);
      alert("Greška pri učitavanju primalaca.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRecipients();
  }, []);

  const filtered = useMemo(() => {
    const lower = searchTerm.toLowerCase();
    return recipients.filter(
        (r) =>
            r.name.toLowerCase().includes(lower) ||
            r.account_number.toLowerCase().includes(lower)
    );
  }, [recipients, searchTerm]);

  function openCreateModal() {
    setEditingRecipient(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEditModal(recipient) {
    setEditingRecipient(recipient);
    setForm({
      name: recipient.name || "",
      account_number: recipient.account_number || "",
    });
    setShowModal(true);
  }

  function closeModal() {
    if (saving) return;
    setShowModal(false);
    setEditingRecipient(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit() {
    const trimmedName = form.name.trim();
    const trimmedAccount = form.account_number.trim();

    if (!trimmedName) {
      alert("Unesi naziv primaoca.");
      return;
    }

    if (!trimmedAccount) {
      alert("Unesi broj računa.");
      return;
    }

    try {
      setSaving(true);

      if (editingRecipient) {
        await updateRecipient(editingRecipient.id, {
          name: trimmedName,
          account_number: trimmedAccount,
        });
      } else {
        await createRecipient({
          name: trimmedName,
          account_number: trimmedAccount,
        });
      }

      closeModal();
      await loadRecipients();
    } catch {
      alert(
          editingRecipient
              ? "Greška pri izmeni primaoca."
              : "Greška pri dodavanju primaoca."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(recipient) {
    const confirmed = window.confirm(
        `Da li sigurno želiš da obrišeš primaoca "${recipient.name}"?`
    );

    if (!confirmed) return;

    try {
      await deleteRecipient(recipient.id);
      await loadRecipients();
    } catch {
      alert("Greška pri brisanju primaoca.");
    }
  }

  return (
      <div className="rp-bg">
        <img src="/bank-logo.png" alt="logo" className="rp-logo" />
        <MenuDropdown />

        <div className="rp-wrapper">
          <div className="rp-page-header">
            <div className="rp-page-title-wrap">
              <button
                  type="button"
                  className="rp-back-btn"
                  onClick={() => navigate("/dashboard")}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>

              <h2 className="rp-page-title">Primaoci</h2>
            </div>

            <div className="rp-header-actions">
              <button
                  className="rp-secondary-btn"
                  onClick={() => navigate("/payments", { state: { from: "recipients" } })}
              >
                Istorija plaćanja →
              </button>

              <button className="rp-secondary-btn" onClick={openCreateModal}>
                + Dodaj primaoca
              </button>

              <button className="rp-new-btn" onClick={() => navigate("/payment")}>
                + Novo plaćanje
              </button>
            </div>
          </div>

          <div className="rp-card">
            <div className="rp-card-header">
              <div className="rp-search-wrapper">
                <span className="rp-search-icon">🔍</span>
                <input
                    className="rp-search"
                    placeholder="Pretraga po imenu ili broju računa..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                    <button
                        type="button"
                        className="rp-clear-btn"
                        onClick={() => setSearchTerm("")}
                    >
                      ✕
                    </button>
                )}
              </div>

              <span className="rp-result-count">
              {filtered.length} / {recipients.length} primaoca
            </span>
            </div>

            {loading ? (
                <div className="rp-loading">Učitavanje...</div>
            ) : filtered.length === 0 ? (
                <div className="rp-empty">Nema pronađenih primaoca.</div>
            ) : (
                <table className="rp-table">
                  <thead>
                  <tr>
                    <th>#</th>
                    <th>Ime i prezime</th>
                    <th>Broj računa</th>
                    <th>Akcije</th>
                  </tr>
                  </thead>
                  <tbody>
                  {filtered.map((r, i) => (
                      <tr key={r.id} className="rp-row">
                        <td className="rp-td-index">{i + 1}</td>
                        <td className="rp-td-name">
                          <div className="rp-avatar">{r.name.charAt(0)}</div>
                          {r.name}
                        </td>
                        <td className="rp-td-account">{r.account_number}</td>
                        <td className="rp-td-actions">
                          <div className="rp-actions-group">
                            <button
                                type="button"
                                className="rp-action-btn"
                                onClick={() => openEditModal(r)}
                            >
                              Izmeni
                            </button>
                            <button
                                type="button"
                                className="rp-action-btn rp-action-btn--danger"
                                onClick={() => handleDelete(r)}
                            >
                              Obriši
                            </button>
                          </div>
                        </td>
                      </tr>
                  ))}
                  </tbody>
                </table>
            )}
          </div>
        </div>

        {showModal && (
            <div className="rp-modal">
              <div className="rp-modal-content">
                <h3>{editingRecipient ? "Izmena primaoca" : "Dodavanje primaoca"}</h3>

                <div className="rp-form-group">
                  <label>Naziv</label>
                  <input
                      type="text"
                      value={form.name}
                      onChange={(e) =>
                          setForm((prev) => ({ ...prev, name: e.target.value }))
                      }
                      placeholder="Unesi naziv primaoca"
                  />
                </div>

                <div className="rp-form-group">
                  <label>Broj računa</label>
                  <input
                      type="text"
                      value={form.account_number}
                      onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            account_number: e.target.value,
                          }))
                      }
                      placeholder="Unesi broj računa"
                  />
                </div>

                <div className="rp-modal-actions">
                  <button
                      type="button"
                      className="rp-modal-cancel-btn"
                      onClick={closeModal}
                  >
                    Otkaži
                  </button>
                  <button
                      type="button"
                      className="rp-modal-save-btn"
                      disabled={saving}
                      onClick={handleSubmit}
                  >
                    {saving ? "Čuvanje..." : "Sačuvaj"}
                  </button>
                </div>
              </div>
            </div>
        )}
      </div>
  );
}