// src/components/river-chart/river-notes.ts
import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { userPreferencesService } from "../../utility/user-preferences-service";
import { authService } from "../../utility/auth-service";

@customElement("river-notes")
export class RiverNotesComponent extends LitElement {
  @property({ type: String }) riverId = "";

  @state() private userNote: string | null = null;
  @state() private isEditingNote = false;
  @state() private noteIsLoading = false;
  @state() private noteError: string | null = null;
  @state() private isSignedIn = false;

  static styles = css`
    .notes-section {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #eee;
    }

    .notes-section h3 {
      margin-top: 0;
      margin-bottom: 8px;
      font-size: 1.1em;
      color: #263238;
    }

    .notes-section textarea {
      width: 100%;
      box-sizing: border-box;
      min-height: 80px;
      padding: 8px;
      border-radius: 4px;
      border: 1px solid #ccc;
      resize: vertical;
      font-family: inherit;
      font-size: 0.95em;
    }

    .note-display {
      white-space: pre-wrap;
      word-wrap: break-word;
      background-color: #f9f9f9;
      padding: 10px;
      border-radius: 4px;
      border: 1px solid #eee;
      min-height: 40px;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .note-display:hover {
      background-color: #f0f0f0;
    }

    .notes-actions {
      margin-top: 8px;
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }

    .notes-actions button {
      padding: 6px 12px;
      border-radius: 4px;
      border: 1px solid transparent;
      cursor: pointer;
      font-weight: 500;
      transition: background-color 0.2s;
    }

    .save-btn {
      background-color: #28a745;
      color: white;
      border-color: #28a745;
    }
    .save-btn:hover {
      background-color: #218838;
    }

    .cancel-btn {
      background-color: #6c757d;
      color: white;
      border-color: #6c757d;
    }
    .cancel-btn:hover {
      background-color: #5a6268;
    }

    .edit-btn {
      background-color: #007bff;
      color: white;
      border-color: #007bff;
    }
    .edit-btn:hover {
      background-color: #0069d9;
    }

    .error {
      color: #d32f2f;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    authService.onAuthStateChanged(user => {
      const wasSignedIn = this.isSignedIn;
      this.isSignedIn = !!user;
      if (this.isSignedIn && !wasSignedIn) {
        this.fetchUserNote();
      } else if (!this.isSignedIn && wasSignedIn) {
        this.userNote = null;
        this.isEditingNote = false;
        this.noteError = null;
      }
    });
    this.isSignedIn = authService.isSignedIn();
  }

  protected async willUpdate(changed: Map<string | number | symbol, unknown>) {
    if (changed.has("riverId") && this.riverId && this.isSignedIn) {
      this.fetchUserNote();
    }
  }

  private async fetchUserNote(): Promise<void> {
    if (!this.riverId || !this.isSignedIn) {
      this.userNote = null;
      return;
    }
    this.noteIsLoading = true;
    this.noteError = null;
    try {
      const noteData = await userPreferencesService.getUserNote(this.riverId);
      this.userNote = noteData?.note?.trim() ?? null;
    } catch (error) {
      this.noteError = "Could not load your note.";
      console.error(`Failed to fetch note for ${this.riverId}`, error);
    } finally {
      this.noteIsLoading = false;
    }
  }

  private handleNoteEdit(e: Event) {
    e.stopPropagation();
    this.isEditingNote = true;
  }

  private handleNoteCancel(e: Event) {
    e.stopPropagation();
    this.isEditingNote = false;
    this.noteError = null;
  }

  private async handleNoteSave(e: Event) {
    e.stopPropagation();
    if (!this.riverId) return;

    const textarea = this.shadowRoot?.querySelector('textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const newNote = textarea.value.trim();
    this.noteIsLoading = true;
    this.noteError = null;

    try {
      await userPreferencesService.saveUserNote(this.riverId, newNote);
      this.userNote = newNote ? newNote : null;
      this.isEditingNote = false;
    } catch (error) {
      this.noteError = "Failed to save note.";
      console.error(`Failed to save note for ${this.riverId}`, error);
    } finally {
      this.noteIsLoading = false;
    }
  }

  render() {
    if (!this.isSignedIn) {
      return null;
    }

    return html`
      <div class="notes-section">
        <h3>My Notes</h3>
        ${this.noteIsLoading
          ? html`<p>Loading...</p>`
          : this.noteError
          ? html`<p class="error">${this.noteError}</p>`
          : this.isEditingNote
            ? html`
                <textarea
                  aria-label="River note"
                  .value=${this.userNote || ''}></textarea>
                <div class="notes-actions">
                  <button class="save-btn" @click=${this.handleNoteSave}>Save</button>
                  <button class="cancel-btn" @click=${this.handleNoteCancel}>Cancel</button>
                </div>
              `
            : html`
                <div class="note-display" @click=${this.handleNoteEdit} title="Click to edit note">${
                  this.userNote ? this.userNote : html`<em style="color: #666;">No notes for this river yet.</em>`
                }</div>
                <div class="notes-actions">
                  <button class="edit-btn" @click=${this.handleNoteEdit}>
                    ${this.userNote ? 'Edit Note' : 'Add Note'}
                  </button>
                </div>
              `}
      </div>
    `;
  }
}
