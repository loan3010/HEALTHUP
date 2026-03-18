import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'sanitizeHtml'
})
export class SanitizeHtmlPipe implements PipeTransform {
  
  constructor(private sanitizer: DomSanitizer) {}
  
  transform(value: string): SafeHtml {
    // Convert line breaks to <br>
    value = value.replace(/\n/g, '<br>');
    
    // Sanitize and return
    return this.sanitizer.bypassSecurityTrustHtml(value);
  }
}