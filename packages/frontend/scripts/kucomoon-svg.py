from math import pi, tan, cos, sin, acos

GOLDEN_RATIO = 1.618033988749895

dx = 5
dy = 5
k = 100 # K main line height
r = 80 # circle radius
alpha = 0.8760580505981933 # K angle = pi/2 - atan(5/6)

k_w_half = k / 4 * tan(alpha) # K x-offset from circle
cc = (r + dx, r + dy) # circle center point
kc = (r + dx - k_w_half, r + dy) # K center point
ks = (kc[0], kc[1] - k / 2) # K main line start point
ke = (kc[0], kc[1] + k / 2) # K main line end point
k1e = (ks[0] + k * tan(alpha) / 2, ks[1]) # K first line end point
k2e = (ke[0] + k * tan(alpha) / 2, ke[1]) # K second line end point

# calc radius diff that puts the moon behind-above the triangle
moon_radius = 32
k_side_length = k / (2 * cos(alpha))
beta = pi / 2 - alpha

h = k_side_length * sin(alpha) / GOLDEN_RATIO
w = (k_side_length - h) * cos(alpha)
curve_offset_y = moon_radius * sin(acos((w + 1) / moon_radius))
center_offset_y = curve_offset_y + moon_radius - k_w_half

print(f"""\
  <svg id='kucomoon' width='{2 * (dx + r)}' height='{2 * (dx + r)}' stroke-width='{dx}' stroke-linecap='round' stroke-linejoin='round'>
    <g stroke='white'>
      <line x1='{ks[0]}' y1='{ks[1]}' x2='{ke[0]}' y2='{ke[1]}' />
      <line x1='{kc[0]}' y1='{kc[1]}' x2='{k1e[0]}' y2='{k1e[1]}' />
      <line x1='{kc[0]}' y1='{kc[1]}' x2='{k2e[0]}' y2='{k2e[1]}' />
    </g>
    <g stroke='white' fill='none'>
      <circle cx='{cc[0]}' cy='{cc[1]}' r='{r}' />
    </g>
    <g fill='#171818' stroke='FireBrick'>
      <polygon points='{cc[0]} {cc[1] - k_w_half}, {cc[0] + k / 2} {cc[1] + k_w_half}, {cc[0] - k / 2} {cc[1] + k_w_half}' />
    </g>
  </svg>
""")

print("move K main line down by:", round(k / 2 * tan(alpha), 5))
print("move circle up by", round(center_offset_y, 5))
