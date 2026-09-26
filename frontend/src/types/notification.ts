export type NotificationType =
  | "TASK_ASSIGNED"
  | "TASK_STATUS_CHANGED"
  | "TASK_COMMENT"
  | "INVOICE_OVERDUE"
  | "PAYMENT_RECEIVED"
  | "MENTION"
  | "SYSTEM_ALERT"
  | (string & {});

export interface AppNotification {
  id: string;
  notificationType: NotificationType;
  title: string;
  body: string;
  entity: string | null;
  entityId: string | null;
  /** In-app route this notification opens. */
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
}

/** The list endpoint adds `unread` so the badge does not need a second request. */
export interface NotificationPage {
  data: AppNotification[];
  meta: {
    page: number;
    limit: number;
    total: number;
    pageCount: number;
    unread: number;
  };
}
