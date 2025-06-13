import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { getUserNotes, updateUserNotes, deleteUserNotes, undoUserNotes, type UserNote } from '../utility/notes-api';

@customElement("river-notes")
export class RiverNotes extends LitElement {
  @property({ type: String }) siteCode = "";
  @property({ type: String }) idToken: string | null = null;

  @state() private _noteData: UserNote | null = null;
  @state() private _isLoading = false;
  @state() private _error: string | null = null;
  @state() private _isEditing = false;
  @state() private _editText = "";

  static styles = css`
    :host {
      display: block;
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #eee;
    }
    .notes-container {
      padding: 10px;
      background-color: #f9f9f9;
      border-radius: 4px;
    }
    textarea {
      width: 100%;
      min-height: 80px;
      margin-bottom: 10px;
      box-sizing: border-box;
    }
    .actions button {
      margin-right: 8px;
      padding: 6px 12px;
      cursor: pointer;
    }
    .note-display {
      white-space: pre-wrap; /* Preserve line breaks */
      padding: 8px;
      border: 1px solid #ddd;
      background-color: #fff;
      min-height: 50px;
      margin-bottom:10px;
    }
    .error { color: red; }
    .empty-notes { color: #757575; font-style: italic; }
  `;

  protected async willUpdate(changedProperties: Map<string | number | symbol, unknown>) {
    if ((changedProperties.has("siteCode") || changedProperties.has("idToken")) && this.siteCode && this.idToken) {
      this._fetchNotes();
    }
  }

  private async _fetchNotes() {
    if (!this.idToken || !this.siteCode) return;
    this._isLoading = true;
    this._error = null;
    try {
      this._noteData = await getUserNotes(this.siteCode, this.idToken);
    } catch (e: unknown) {
      this._error = e instanceof Error ? e.message : "Failed to load notes.";
      this._noteData = null;
    } finally {
      this._isLoading = false;
    }
  }

  private _handleEdit() {
    this._editText = this._noteData?.currentNote || "";
    this._isEditing = true;
  }

  private _handleCancel() {
    this._isEditing = false;
    this._editText = "";
    this._error = null; // Clear previous save errors
  }

  private async _handleSave() {
    if (!this.idToken || !this.siteCode) return;
    this._isLoading = true;
    this._error = null;
    try {
      const result = await updateUserNotes(this.siteCode, this._editText, this.idToken);
      this._noteData = result.data;
      this._isEditing = false;
      this._editText = "";
    } catch (e: unknown) {
      this._error = e instanceof Error ? e.message : "Failed to save note.";
    } finally {
      this._isLoading = false;
    }
  }

  private async _handleDelete() {
    if (!this.idToken || !this.siteCode || !confirm("Are you sure you want to delete these notes?")) return;
    this._isLoading = true;
    this._error = null;
    try {
      await deleteUserNotes(this.siteCode, this.idToken);
      this._noteData = { siteCode: this.siteCode, currentNote: "", versions: [], createdAt: null, updatedAt: null }; // Reset
    } catch (e: unknown) {
      this._error = e instanceof Error ? e.message : "Failed to delete note.";
    } finally {
      this._isLoading = false;
    }
  }

  private async _handleUndo() {
    if (!this.idToken || !this.siteCode) return;
    this._isLoading = true;
    this._error = null;
    try {
      const result = await undoUserNotes(this.siteCode, this.idToken);
      this._noteData = result.data;
    } catch (e: unknown) {
      this._error = e instanceof Error ? e.message : "Failed to undo note.";
    } finally {
      this._isLoading = false;
    }
  }

  render() {
    if (!this.idToken) {
      return html`<p><em>Login to manage notes for this river.</em></p>`;
    }
    if (this._isLoading && !this._noteData) { // Initial load
      return html`<p>Loading notes...</p>`;
    }

    return html`
      <div class="notes-container">
        <h4>My Notes for ${this.siteCode}</h4>
        ${this._error ? html`<p class="error">${this._error}</p>` : nothing}

        ${this._isEditing ? html`
          <textarea .value=${this._editText} @input=${(e: Event) => this._editText = (e.target as HTMLTextAreaElement).value}></textarea>
          <div class="actions">
            <button @click=${this._handleSave} ?disabled=${this._isLoading}>Save</button>
            <button @click=${this._handleCancel} ?disabled=${this._isLoading}>Cancel</button>
          </div>
        ` : html`
          ${this._noteData?.currentNote ? html`
            <div class="note-display">${this._noteData.currentNote}</div>
          ` : html`
            <p class="empty-notes">No notes yet.</p>
          `}
          <div class="actions">
            <button @click=${this._handleEdit}>${this._noteData?.currentNote ? 'Edit Note' : 'Add Note'}</button>
            ${this._noteData?.currentNote ? html`
              <button @click=${this._handleDelete} ?disabled=${this._isLoading}>Delete</button>
            ` : nothing}
            ${this._noteData && this._noteData.versions.length > 0 ? html`
              <button @click=${this._handleUndo} ?disabled=${this._isLoading}>Undo</button>
            ` : nothing}
          </div>
        `}
        ${this._isLoading && this._noteData ? html`<p><em>Processing...</em></p>` : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "river-notes": RiverNotes;
  }
}