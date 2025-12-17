export type GroupSettings = {
  stakes_fixed: boolean;
  stakes_sb?: number | null;
  stakes_bb?: number | null;
  stakes_value?: string | null;
  ranking_top_n: number;
};

export type GroupDoc = {
  group_id: number;
  group_name: string;
  creator: string;
  player_password: string;
  admin_password: string;
  settings?: GroupSettings;
  creator_name?: string;
  creator_uid?: string;
};

export type PlayerDoc = {
  player_id: number;
  group_id: number;
  display_name: string;
  email: string;
  total_balance: number;
};

export type BalanceDoc = {
  balance_id: number;
  group_id: number;
  player_id: number; // 6桁
  player_uid: string;
  date: string;
  date_ts: any; // Timestamp
  stakes: string; // "SB/BB"
  buy_in_bb: number;
  ending_bb: number;
  memo: string;
  last_updated: any; // Timestamp
  is_deleted: boolean;
};

// PlayerGroupPage uses this slightly extended type, but we can make it compatible
export type BalanceRow = BalanceDoc & { __id: string };

export type HistoryDoc = {
  history_id: number;
  balance_id: number;
  changed_at: any; // Timestamp
  change_category: "create" | "update" | "delete";
  change_details: any; // {before?: BalanceDoc, after?: BalanceDoc}
  changer_uid: string;
  changer_player_id: number;
};
