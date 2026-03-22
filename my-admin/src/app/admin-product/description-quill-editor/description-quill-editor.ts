import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import Quill from 'quill';

/**
 * Editor mô tả HTML bằng Quill (toolbar tối giản).
 * Lưu HTML vào `formData.description` khi admin gõ — chỉ submit khi Lưu SP.
 */
@Component({
  selector: 'app-description-quill-editor',
  standalone: true,
  template: `
    <div class="quill-editor-shell">
      <div #editorHost class="quill-host" aria-label="Mô tả đầy đủ"></div>
    </div>
  `,
  styles: [
    `
      .quill-editor-shell {
        border: 1px solid #cfe8d4;
        border-radius: 10px;
        overflow: hidden;
        background: #fff;
      }
      .quill-host {
        min-height: 200px;
      }
      :host ::ng-deep .ql-toolbar {
        border: none;
        border-bottom: 1px solid #e0ebe1;
        background: #f9fdf9;
      }
      :host ::ng-deep .ql-container {
        border: none;
        font-size: 0.95rem;
      }
    `
  ]
})
export class DescriptionQuillEditorComponent implements AfterViewInit, OnChanges {
  @ViewChild('editorHost') host!: ElementRef<HTMLDivElement>;

  /** HTML đã lưu (load từ API). */
  @Input() value = '';
  @Output() valueChange = new EventEmitter<string>();

  private quill?: Quill;
  private syncingFromInput = false;

  ngAfterViewInit(): void {
    this.quill = new Quill(this.host.nativeElement, {
      theme: 'snow',
      modules: {
        toolbar: [['bold', 'italic', 'underline'], [{ list: 'ordered' }, { list: 'bullet' }], ['link']]
      }
    });
    const html = String(this.value || '').trim();
    if (html) {
      this.syncingFromInput = true;
      this.quill.clipboard.dangerouslyPasteHTML(html);
      this.syncingFromInput = false;
    }
    this.quill.on('text-change', () => {
      if (this.syncingFromInput || !this.quill) return;
      const root = this.quill.root as HTMLElement;
      const h = root.innerHTML;
      const empty = h === '<p><br></p>' || h === '<p></p>';
      this.valueChange.emit(empty ? '' : h);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['value'] || !this.quill) return;
    const next = String(this.value || '').trim();
    const cur = (this.quill.root as HTMLElement).innerHTML;
    const curNorm = cur === '<p><br></p>' ? '' : cur;
    if (next === curNorm) return;
    this.syncingFromInput = true;
    if (!next) this.quill.setText('');
    else this.quill.clipboard.dangerouslyPasteHTML(next);
    this.syncingFromInput = false;
  }
}
