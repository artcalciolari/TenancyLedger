interface NotificationNavigation {
  resourceId: string;
  resourceType: string;
}

export function notificationDestination(notification: NotificationNavigation): string {
  return notification.resourceType === 'CONTRACT'
    ? `/contracts/${notification.resourceId}`
    : `/invoices/${notification.resourceId}`;
}

export function isRenewalNotification(type: string): boolean {
  return type === 'RENEWAL_DUE' || type === 'PAYMENT_OVERDUE';
}
