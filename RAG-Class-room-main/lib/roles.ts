import type { Role } from "./auth";

export const ROLE_HOME: Record<Role, string> = {
  student: "/dashboard",
  parent: "/parent/dashboard",
  school: "/school/dashboard",
  admin: "/admin/dashboard",
};

export const PORTAL_NAV: Record<Role, { label: string; href: string }[]> = {
  student: [
    { label: "Home", href: "/dashboard" },
    { label: "Classroom", href: "/classroom" },
    { label: "Materials", href: "/materials" },
    { label: "Progress", href: "/progress" },
    { label: "Messages", href: "/messages" },
    { label: "Profile", href: "/profile" },
  ],
  parent: [
    { label: "Dashboard", href: "/parent/dashboard" },
    { label: "Children", href: "/parent/children/add" },
    { label: "Consent", href: "/parent/consent" },
    { label: "Billing", href: "/parent/billing" },
    { label: "Settings", href: "/parent/settings" },
  ],
  school: [
    { label: "Dashboard", href: "/school/dashboard" },
    { label: "Classes", href: "/school/classes" },
    { label: "Reports", href: "/school/reports" },
    { label: "Teachers", href: "/school/teachers" },
    { label: "Billing", href: "/school/billing" },
  ],
  admin: [
    { label: "Dashboard", href: "/admin/dashboard" },
    { label: "Subscribers", href: "/admin/subscribers" },
    { label: "Users", href: "/admin/users" },
    { label: "Subscriptions", href: "/admin/subscriptions" },
    { label: "Content", href: "/admin/content" },
    { label: "Creator Studio", href: "/admin/creator" },
    { label: "Material QA", href: "/admin/material-qa" },
    { label: "Exam Patterns", href: "/admin/exam-patterns" },
    { label: "Messages", href: "/admin/messages" },
    { label: "Analytics", href: "/admin/analytics" },
  ],
};
