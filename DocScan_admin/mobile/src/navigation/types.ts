export type AuthStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
  ResetPassword: { email?: string } | undefined;
};

export type UsersStackParamList = {
  UsersList: undefined;
  UserDetail: { userId: string };
};

export type DocumentsStackParamList = {
  DocumentsList: undefined;
  DocumentDetail: { documentId: string };
};

export type SupportStackParamList = {
  SupportList: undefined;
  TicketDetail: { ticketId: string };
};

export type MoreStackParamList = {
  MoreHub: undefined;
  SubscriptionsPayments: undefined;
  StorageMonitoring: undefined;
  Notifications: undefined;
  AuditLogs: undefined;
};

export type MainTabParamList = {
  DashboardTab: undefined;
  UsersTab: undefined;
  DocumentsTab: undefined;
  SupportTab: undefined;
  MoreTab: undefined;
};
