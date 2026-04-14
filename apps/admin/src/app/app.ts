import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ShellAdminComponent } from '@lego-platform/shell/admin';

@Component({
  imports: [ShellAdminComponent, RouterOutlet],
  selector: 'lego-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
