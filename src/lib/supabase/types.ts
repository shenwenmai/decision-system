export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      decisions: {
        Row: {
          id: string
          user_id: string
          input: string
          diagnosis: Json | null
          analysis: Json | null
          verdict: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          input: string
          diagnosis?: Json | null
          analysis?: Json | null
          verdict?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          diagnosis?: Json | null
          analysis?: Json | null
          verdict?: string | null
          updated_at?: string
        }
      }
    }
  }
}

// App-level types
export interface DecisionRow {
  id: string
  user_id: string
  input: string
  diagnosis: import('@/types/decision').Diagnosis | null
  analysis: AnalysisData | null
  verdict: string | null
  created_at: string
  updated_at: string
}

export interface AnalysisData {
  advisorStatements: { advisor: string; content: string; veto: boolean }[]
  collisionContent: string
  actionPlan: string | null
}
