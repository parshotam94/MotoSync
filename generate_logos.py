import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from PIL import Image, ImageDraw, ImageFont

os.makedirs('report_assets', exist_ok=True)

# 1. Generate SKIT Logo (matching the emblem in page 1 of the reference PDF)
def generate_skit_logo():
    fig, ax = plt.subplots(figsize=(3.5, 3.2), facecolor='white')
    ax.set_facecolor('white')
    ax.set_xlim(-2.5, 2.5)
    ax.set_ylim(-2.5, 2.5)
    ax.axis('off')

    # Red cog / gear rim on top
    gear_arc = patches.Wedge((0, 0.4), 1.6, 15, 165, width=0.4, facecolor='#B91C1C', edgecolor='#991B1B', lw=1.5)
    ax.add_patch(gear_arc)

    # Gear teeth
    import numpy as np
    for angle in np.linspace(25, 155, 9):
        rad = np.radians(angle)
        x = 1.65 * np.cos(rad)
        y = 0.4 + 1.65 * np.sin(rad)
        tooth = patches.RegularPolygon((x, y), numVertices=4, radius=0.18, orientation=rad, facecolor='#B91C1C', edgecolor='#991B1B')
        ax.add_patch(tooth)

    # Text SKIT inside gear
    ax.text(0, 1.1, "SKIT", color='white', fontsize=18, fontweight='bold', fontfamily='sans-serif', ha='center', va='center')

    # Blue Globe / Dome with meridians and parallels
    globe_bg = patches.Wedge((0, 0.4), 1.2, 195, 345, facecolor='#F0F9FF', edgecolor='#0369A1', lw=2)
    ax.add_patch(globe_bg)

    # Meridian lines (vertical curves)
    for r_scale in [0.35, 0.7, 1.05]:
        ellipse = patches.Arc((0, 0.4), 2 * r_scale, 2.4, angle=0, theta1=195, theta2=345, color='#0284C7', lw=1.2)
        ax.add_patch(ellipse)
    # Parallels (horizontal curves)
    for y_offset in [-0.15, -0.45]:
        line = patches.Arc((0, 0.4 + y_offset), 2.2, 0.9, angle=0, theta1=200, theta2=340, color='#0284C7', lw=1.2)
        ax.add_patch(line)

    # Lower Red Banner Ribbon with Motto
    banner = patches.FancyBboxPatch((-1.7, -1.5), 3.4, 0.55, boxstyle="square,pad=0", facecolor='white', edgecolor='#B91C1C', lw=1.8)
    ax.add_patch(banner)
    ax.text(0, -1.25, "ASATO MA SADGAMAYA", color='#B91C1C', fontsize=10, fontweight='bold', fontfamily='sans-serif', ha='center', va='center')

    fig.savefig('report_assets/skit_logo.png', dpi=300, bbox_inches='tight')
    plt.close(fig)
    print("SKIT logo generated.")

# 2. Generate Celebal Certificate Image (matching Page 3 of the reference PDF)
def generate_celebal_certificate():
    fig, ax = plt.subplots(figsize=(8.5, 6.0), facecolor='white')
    ax.set_facecolor('white')
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 7)
    ax.axis('off')

    # Border around certificate
    cert_border = patches.Rectangle((0.1, 0.1), 9.8, 6.8, facecolor='white', edgecolor='#0284C7', lw=2)
    ax.add_patch(cert_border)
    inner_border = patches.Rectangle((0.2, 0.2), 9.6, 6.6, facecolor='white', edgecolor='#E2E8F0', lw=1)
    ax.add_patch(inner_border)

    # Top Header Left: Celebal Technologies Logo
    # Red hexagon logo + Text
    hex_logo = patches.RegularPolygon((1.0, 6.1), numVertices=6, radius=0.35, facecolor='#DC2626')
    ax.add_patch(hex_logo)
    ax.text(1.0, 6.1, "CT", color='white', fontsize=11, fontweight='bold', ha='center', va='center')
    ax.text(1.5, 6.2, "CELEBAL", color='#1E293B', fontsize=13, fontweight='bold', va='center')
    ax.text(1.5, 5.9, "TECHNOLOGIES", color='#64748B', fontsize=8, fontweight='bold', va='center')

    # Top Header Right: Celebal Excellence Internship
    ax.text(8.8, 6.2, "CELEBAL", color='#1E3A8A', fontsize=10, fontweight='bold', ha='right')
    ax.text(8.8, 5.95, "EXCELLENCE", color='#0284C7', fontsize=10, fontweight='bold', ha='right')
    ax.text(8.8, 5.75, "INTERNSHIP", color='#475569', fontsize=8, fontweight='bold', ha='right')

    # Title: CERTIFICATE OF INTERNSHIP
    ax.text(0.8, 4.9, "CERTIFICATE", color='#0F172A', fontsize=24, fontweight='bold', ha='left')
    ax.text(0.8, 4.4, "OF INTERNSHIP", color='#64748B', fontsize=15, fontweight='bold', ha='left')

    # Recipient details
    ax.text(0.8, 3.8, "This certificate is proudly awarded to", color='#64748B', fontsize=10, style='italic')
    ax.text(0.8, 3.4, "Parshotam Singh", color='#0F172A', fontsize=16, fontweight='bold')
    ax.text(0.8, 3.05, "Enrollment ID : CT_CSI_DS_768", color='#1E293B', fontsize=10, fontweight='bold')

    # Body
    body_text = (
        "For successfully completing the Celebal Excellence Internship 2026 at Celebal\n"
        "Technologies in the field of Data Science for the duration of 25 May 2026 to 25 Jul 2026.\n"
        "Throughout the internship, you exhibited excellent problem-solving skills, dedication, and\n"
        "a proactive attitude toward learning and innovation. Your performance and contributions\n"
        "were commendable.\n"
        "We appreciate your efforts and wish you continued success in your professional journey."
    )
    ax.text(0.8, 2.65, body_text, color='#334155', fontsize=9.2, linespacing=1.45, va='top')

    # Signature
    ax.text(0.8, 1.15, "Sharthak Acharjee", color='#0F172A', fontsize=11, fontweight='bold')
    ax.text(0.8, 0.9, "Senior Manager", color='#64748B', fontsize=9)
    # Simulated signature line
    ax.plot([0.8, 2.0], [1.35, 1.45], color='#1E3A8A', lw=1.5)
    ax.plot([1.2, 1.8], [1.5, 1.3], color='#1E3A8A', lw=1.2)

    # Bottom Right Decorative Geometric Shapes (matching reference PDF)
    circle1 = patches.Circle((8.2, 0.8), 0.7, facecolor='#0284C7', alpha=0.9)
    circle2 = patches.Circle((7.5, 0.5), 0.5, facecolor='#1E3A8A', alpha=0.9)
    rect1 = patches.Rectangle((8.0, 0.1), 1.8, 1.2, facecolor='#38BDF8', alpha=0.3)
    ax.add_patch(circle1)
    ax.add_patch(circle2)
    ax.add_patch(rect1)

    fig.savefig('report_assets/celebal_certificate.png', dpi=300, bbox_inches='tight')
    plt.close(fig)
    print("Celebal certificate generated.")

if __name__ == '__main__':
    generate_skit_logo()
    generate_celebal_certificate()
