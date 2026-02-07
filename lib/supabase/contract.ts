export const SUPABASE_CONTRACT = {
  tables: [
    "profiles",
    "study_groups",
    "group_memberships",
    "library_folders",
    "documents",
    "document_shares",
    "flashcard_sets",
    "flashcards",
    "flashcard_set_shares",
    "quiz_sets",
    "quiz_questions",
    "quiz_set_shares",
    "exercise_sets",
    "exercises",
    "exercise_set_shares",
    "tags",
    "saved_views",
    "xp_events",
    "pvp_challenges"
  ],
  columnChecks: [
    { table: "documents", columns: ["id", "owner_id", "visibility", "folder_id"] },
    { table: "quiz_sets", columns: ["id", "owner_id", "visibility"] },
    { table: "flashcard_sets", columns: ["id", "owner_id", "visibility"] },
    { table: "exercise_sets", columns: ["id", "owner_id", "visibility"] }
  ],
  rpcs: ["is_app_admin"]
} as const;
