import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ArchiveExplorerComponent } from './archive-explorer.component';
import { gzipSync } from 'fflate';
import JSZip from 'jszip';

describe('ArchiveExplorerComponent', () => {
  let component: ArchiveExplorerComponent;
  let fixture: ComponentFixture<ArchiveExplorerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArchiveExplorerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ArchiveExplorerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create component', () => {
    expect(component).toBeTruthy();
  });

  it('should parse and preview .zip archives', async () => {
    const zip = new JSZip();
    zip.file('sample.txt', 'Hello from zip archive!');
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const mockFile = new File([zipBlob], 'archive.zip', { type: 'application/zip' });

    await component.loadFile(mockFile);

    expect(component.entries().length).toBe(1);
    expect(component.entries()[0].name).toBe('sample.txt');

    await component.viewEntry(component.entries()[0]);
    expect(component.previewText()).toBe('Hello from zip archive!');
  });

  it('should parse and preview .tar.gz archives', async () => {
    // Construct a minimal tar archive with one text file
    const encoder = new TextEncoder();
    const fileName = 'test.txt';
    const content = 'Hello from tar.gz archive!';
    const contentBytes = encoder.encode(content);

    const tarBlock = new Uint8Array(1024); // 512 header + 512 content block
    // file name
    tarBlock.set(encoder.encode(fileName), 0);
    // mode: 0000644
    tarBlock.set(encoder.encode('0000644\0'), 100);
    // uid & gid
    tarBlock.set(encoder.encode('0000000\0'), 108);
    tarBlock.set(encoder.encode('0000000\0'), 116);
    // size (octal): 12 bytes
    const sizeOctal = contentBytes.length.toString(8).padStart(11, '0') + ' ';
    tarBlock.set(encoder.encode(sizeOctal), 124);
    // mtime
    tarBlock.set(encoder.encode('14000000000 '), 136);
    // typeflag '0' for normal file
    tarBlock[156] = '0'.charCodeAt(0);
    // ustar magic
    tarBlock.set(encoder.encode('ustar\0'), 257);
    tarBlock.set(encoder.encode('00'), 263);

    // checksum calculation
    for (let i = 148; i < 156; i++) tarBlock[i] = 32; // spaces
    let chksum = 0;
    for (let i = 0; i < 512; i++) chksum += tarBlock[i];
    const chksumStr = chksum.toString(8).padStart(6, '0') + '\0 ';
    tarBlock.set(encoder.encode(chksumStr), 148);

    // content block
    tarBlock.set(contentBytes, 512);

    // gzip the tar
    const gzipped = gzipSync(tarBlock);
    const mockFile = new File([gzipped as unknown as BlobPart], 'archive.tar.gz', { type: 'application/gzip' });

    await component.loadFile(mockFile);

    expect(component.entries().length).toBe(1);
    expect(component.entries()[0].name).toBe('test.txt');
    expect(component.entries()[0].size).toBe(contentBytes.length);

    await component.viewEntry(component.entries()[0]);
    expect(component.previewText()).toBe(content);
  });
});

