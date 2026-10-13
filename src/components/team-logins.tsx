import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { companies } from "@/lib/workspace-data";
import {
  ACCESS_FEATURES,
  featureLabel,
  featuresCreatorCanAssign,
  ROLE_NAMES,
  type RoleType,
} from "@/lib/auth-service";
import {
  canManageStaff,
  createStaffLogin,
  deleteStaffLogin,
  listStaffDocuments,
  listStaffLogins,
  openStaffDocument,
  updateStaffLogin,
  uploadStaffDocument,
  type StaffLogin,
  type StaffStatus,
} from "@/lib/login-admin";
import { useWorkspace } from "./workspace-provider";
import { isDemoAuthEnabled } from "@/lib/security";

function fileBase64(file: File) {
  return file.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
  });
}

function StaffCard({
  user,
  owner,
  onChanged,
  onError,
  onNotice,
}: {
  user: StaffLogin;
  owner: boolean;
  onChanged: () => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
}) {
  const [features, setFeatures] = useState<string[]>(user.features || []);
  const [status, setStatus] = useState<StaffStatus>(user.status || "Active");
  const [password, setPassword] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setStatus(user.status || "Active");
    setFeatures(user.features || []);
  }, [user.status, user.features]);

  useEffect(() => {
    if (!owner) return;
    listStaffDocuments({ data: { actorRole: "super_admin", userId: user.id } })
      .then((res) => {
        if (res.ok) setFiles(res.files);
      })
      .catch(() => undefined);
  }, [owner, user.id]);

  const run = async (work: () => Promise<{ ok: boolean; error?: string }>, done: string) => {
    setBusy(true);
    onError("");
    try {
      const res = await work();
      if (!res.ok) {
        onError(res.error || "Could not update this employee.");
        return false;
      }
      if (done) onNotice(done);
      return true;
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : "Could not update this employee.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="module-item flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h4 className="min-w-0 flex-1 text-sm font-bold text-foreground break-words">
          {user.name}
        </h4>
        {owner ? (
          <select
            value={status}
            disabled={busy}
            aria-label={`Status for ${user.name}`}
            className={`staff-status-select shrink-0 ${
              status === "Active" ? "is-active" : "is-inactive"
            }`}
            onChange={(e) => {
              const next = e.target.value as StaffStatus;
              const prev = status;
              setStatus(next);
              void run(
                () =>
                  updateStaffLogin({
                    data: { actorRole: "super_admin", userId: user.id, status: next },
                  }),
                `${user.name} is now ${next}.`,
              ).then((ok) => {
                if (ok) onChanged();
                else setStatus(prev);
              });
            }}
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        ) : (
          <span className={`status shrink-0 ${status === "Active" ? "success" : ""}`}>
            {status}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground break-all">{user.email}</p>
      <p className="text-[11px] font-medium text-foreground/80">
        {user.features?.length
          ? featureLabel(user.features)
          : ROLE_NAMES[user.role as RoleType] || user.role}
        {user.phone ? ` · ${user.phone}` : ""}
      </p>

      {owner && (
        <details className="border-t border-border pt-3">
          <summary className="cursor-pointer text-xs font-semibold text-muted-foreground hover:text-foreground">
            Manage access
          </summary>
          <div className="mt-3 grid gap-2">
            <fieldset className="grid gap-2">
              <legend className="text-xs font-semibold">Features</legend>
              {ACCESS_FEATURES.map((feature) => (
                <label key={feature.id} className="flex items-start gap-2 text-xs">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={features.includes(feature.id)}
                    aria-label={`${feature.name} for ${user.name}`}
                    onChange={(e) =>
                      setFeatures((current) =>
                        e.target.checked
                          ? [...current, feature.id]
                          : current.filter((id) => id !== feature.id),
                      )
                    }
                  />
                  <span>
                    <span className="font-semibold">{feature.name}</span>
                    <span className="block text-muted-foreground">{feature.description}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <Button
              type="button"
              size="sm"
              disabled={busy || features.length === 0}
              className="staff-action-btn h-8 w-full text-xs font-semibold"
              onClick={() =>
                void run(
                  () =>
                    updateStaffLogin({
                      data: { actorRole: "super_admin", userId: user.id, features },
                    }),
                  `${user.name} can use ${featureLabel(features)}.`,
                ).then((ok) => ok && onChanged())
              }
            >
              Save features
            </Button>

            <label className="drawer-field !gap-1">
              New password
              <input
                type="password"
                value={password}
                minLength={6}
                placeholder="At least 6 characters"
                aria-label={`New password for ${user.name}`}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <Button
              type="button"
              size="sm"
              disabled={busy || password.length < 6}
              className="staff-action-btn h-8 w-full text-xs font-semibold"
              onClick={() =>
                run(
                  () =>
                    updateStaffLogin({
                      data: { actorRole: "super_admin", userId: user.id, password },
                    }),
                  `Password updated for ${user.name}.`,
                ).then(() => setPassword(""))
              }
            >
              Set password
            </Button>

            <label className="drawer-field !gap-1">
              PDF documents
              <input
                type="file"
                accept="application/pdf,.pdf"
                aria-label={`Upload PDF for ${user.name}`}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  if (file.type && file.type !== "application/pdf") {
                    onError("Only PDF files can be stored.");
                    return;
                  }
                  void run(async () => {
                    const base64 = await fileBase64(file);
                    const res = await uploadStaffDocument({
                      data: {
                        actorRole: "super_admin",
                        userId: user.id,
                        fileName: file.name,
                        base64,
                      },
                    });
                    if (res.ok) setFiles((current) => [...new Set([...current, res.name])]);
                    return res;
                  }, `${file.name} stored.`);
                }}
              />
            </label>
            {files.length > 0 && (
              <ul className="grid gap-1">
                {files.map((name) => (
                  <li key={name}>
                    <button
                      type="button"
                      className="truncate text-left text-xs font-medium text-primary"
                      onClick={() =>
                        void run(async () => {
                          const res = await openStaffDocument({
                            data: { actorRole: "super_admin", userId: user.id, fileName: name },
                          });
                          if (res.ok) window.open(res.url, "_blank", "noopener");
                          return res;
                        }, "")
                      }
                    >
                      {name}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              className="h-8 text-xs text-destructive"
              onClick={() => {
                if (!window.confirm(`Delete ${user.name}? Their login will stop working.`)) return;
                void run(
                  () => deleteStaffLogin({ data: { actorRole: "super_admin", userId: user.id } }),
                  `${user.name} deleted.`,
                ).then((ok) => ok && onChanged());
              }}
            >
              Delete employee
            </Button>
          </div>
        </details>
      )}
    </div>
  );
}

export function TeamLogins() {
  const { currentUser } = useWorkspace();
  const allowed = featuresCreatorCanAssign(currentUser?.role);
  const [users, setUsers] = useState<StaffLogin[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [features, setFeatures] = useState<string[]>([]);
  const [companyId, setCompanyId] = useState("all");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    listStaffLogins()
      .then((res) => {
        if (res.ok) setUsers(res.users);
        else setError(res.error);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not load logins.");
      });
  };

  useEffect(() => {
    load();
  }, []);

  if (allowed.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Only the owner and the supervisor can create login IDs.
      </p>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const res = await createStaffLogin({
        data: {
          creatorRole: currentUser.role,
          name,
          email,
          password,
          phone,
          features,
          companyId,
        },
      });
      if (!res.ok) {
        setError(res.error);
      } else {
        setNotice(`${res.email} can sign in now.`);
        setName("");
        setEmail("");
        setPassword("");
        setPhone("");
        setFeatures([]);
        load();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not create login.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold">Team logins</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Create a login ID and tick every feature that person should use. A logistics-only ID still sees only the trips assigned to that name.
        </p>
      </div>

      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <label className="drawer-field">
          Full name
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Suresh Driver"
          />
        </label>
        <label className="drawer-field">
          Email
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="suresh.driver@avighna.com"
          />
        </label>
        <label className="drawer-field">
          Password
          <input
            required
            minLength={6}
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
          />
        </label>
        <label className="drawer-field">
          Phone
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98450 33445"
          />
        </label>
        <fieldset className="sm:col-span-2 grid gap-2 sm:grid-cols-2">
          <legend className="text-xs font-semibold mb-1">Features</legend>
          {ACCESS_FEATURES.filter((feature) => allowed.includes(feature.id)).map((feature) => (
            <label
              key={feature.id}
              className="flex items-start gap-2 rounded-lg border border-border bg-card p-2.5 text-xs"
            >
              <input
                type="checkbox"
                className="mt-0.5"
                checked={features.includes(feature.id)}
                onChange={(e) =>
                  setFeatures((current) =>
                    e.target.checked
                      ? [...current, feature.id]
                      : current.filter((id) => id !== feature.id),
                  )
                }
              />
              <span>
                <span className="font-semibold text-foreground">{feature.name}</span>
                <span className="block text-muted-foreground">{feature.description}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <label className="drawer-field">
          Company
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="all">All companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <div className="sm:col-span-2">
          <Button
            type="submit"
            disabled={saving || features.length === 0}
            className="h-9 text-xs font-semibold"
          >
            {saving ? "Creating..." : "Create login ID"}
          </Button>
        </div>
      </form>

      {error && <p className="text-xs text-destructive">{error}</p>}
      {notice && <p className="text-xs text-success">{notice}</p>}

      <div className="module-grid">
        {users.map((user) => (
          <StaffCard
            key={user.id}
            user={user}
            owner={canManageStaff(currentUser?.role)}
            onChanged={load}
            onError={setError}
            onNotice={setNotice}
          />
        ))}
      </div>
      {users.length === 0 && (
        <p className="text-xs text-muted-foreground">No extra logins yet.</p>
      )}

      <p className="text-[11px] text-muted-foreground">
        When you assign a trip, the driver name must match this login’s full name.
        {isDemoAuthEnabled()
          ? " Demo local logins are enabled in this environment only."
          : " Use Supabase Auth logins created above."}
      </p>
    </div>
  );
}
