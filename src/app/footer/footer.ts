import { Component } from '@angular/core';
import { RouterModule } from '@angular/router'; // ✅ thêm dòng này

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterModule], // ✅ thêm dòng này
  templateUrl: './footer.html',
  styleUrl: './footer.css'
})
export class Footer {}