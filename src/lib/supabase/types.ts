export type Database = {
  public: {
    Tables: {
      accounts: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: string;
          initial_balance: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          type: string;
          initial_balance?: number | string;
        };
        Update: {
          name?: string;
          type?: string;
          initial_balance?: number | string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: "income" | "expense";
          parent_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          type: "income" | "expense";
          parent_id?: string | null;
        };
        Update: {
          name?: string;
          type?: "income" | "expense";
          parent_id?: string | null;
        };
        Relationships: [];
      };
      transfers: {
        Row: {
          id: string;
          user_id: string;
          from_account_id: string;
          to_account_id: string;
          amount: number;
          date: string;
          description: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          account_id: string;
          category_id: string | null;
          transfer_id: string | null;
          amount: number;
          date: string;
          description: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          account_id: string;
          category_id: string;
          amount: number | string;
          date: string;
          description: string;
        };
        Update: {
          account_id?: string;
          category_id?: string;
          amount?: number | string;
          date?: string;
          description?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      v_account_balances: {
        Row: {
          account_id: string;
          user_id: string;
          name: string;
          type: string;
          initial_balance: number;
          balance: number;
        };
        Relationships: [];
      };
      v_category_monthly_summary: {
        Row: {
          user_id: string;
          category_root_id: string;
          category_name: string;
          type: "income" | "expense";
          year: number;
          month: number;
          total: number;
        };
        Relationships: [];
      };
      v_monthly_totals: {
        Row: {
          user_id: string;
          year: number;
          month: number;
          total_income: number;
          total_expense: number;
          net: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      create_transfer: {
        Args: {
          p_from_account_id: string;
          p_to_account_id: string;
          p_amount: number | string;
          p_date: string;
          p_description: string | null;
        };
        Returns: string;
      };
      delete_transfer: {
        Args: { p_transfer_id: string };
        Returns: undefined;
      };
    };
  };
};
