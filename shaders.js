const glsl = (x) => x[0]; // Dummy function to enable syntax highlighting for glsl code

export const vertCode = glsl`
out vec2 vUv; // to send to fragment shader

void main() {
    // Compute view direction in world space
    vec4 worldPos = modelViewMatrix * vec4(position, 1.0);
    vec3 viewDir = normalize(-worldPos.xyz);

    // Output vertex position
    gl_Position = projectionMatrix * worldPos;

    vUv = uv;
}`

export const fragCode = glsl`
precision mediump float;

// From vertex shader
in vec2 vUv;

// From uniforms
uniform float u_steps;
uniform float u_maxDis;
uniform float u_eps;

uniform vec2 u_mousePos;
uniform bool u_mouseClick;
uniform vec2 u_currentPos;

uniform float u_ratio;

// Helpers
#define PI 3.1415926538

float gt(float v1, float v2)
{
    return step(v2,v1);
}

float lt(float v1, float v2)
{
    return step(v1, v2);
}

float between(float val, float start, float end)
{
    return gt(val,start)*lt(val,end);
}

float eq(float v1, float v2, float e)
{
    return between(v1, v2-e, v2+e);
}

float s_gt(float v1, float v2, float e)
{
    return smoothstep(v2-e, v2+e, v1);
}

float s_lt(float v1, float v2, float e)
{
    return smoothstep(v1-e, v1+e, v2);
}

float s_between(float val, float start, float end, float epsilon)
{
    return s_gt(val,start,epsilon)*s_lt(val,end,epsilon);
}

float s_eq(float v1, float v2, float e, float s_e)
{
    return s_between(v1, v2-e, v2+e, s_e);
}

float dot2(vec2 v) {
    return dot(v, v);
}

// SDFs from https://iquilezles.org/articles/distfunctions2d/
float sdCircle(vec2 p, float r) {
    return length(p) - r;
}

float sdSegment( in vec2 p, in vec2 a, in vec2 b )
{
    vec2 pa = p-a, ba = b-a;
    float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
    return length( pa - ba*h );
}

float sdStar5(in vec2 p, in float r, in float rf)
{
    const vec2 k1 = vec2(0.809016994375, -0.587785252292);
    const vec2 k2 = vec2(-k1.x,k1.y);
    p.x = abs(p.x);
    p -= 2.0*max(dot(k1,p),0.0)*k1;
    p -= 2.0*max(dot(k2,p),0.0)*k2;
    p.x = abs(p.x);
    p.y -= r;
    vec2 ba = rf*vec2(-k1.y,k1.x) - vec2(0,1);
    float h = clamp( dot(p,ba)/dot(ba,ba), 0.0, r );
    return length(p-ba*h) * sign(p.y*ba.x-p.x*ba.y);
}

float sdMoon(vec2 p, float d, float ra, float rb )
{
    p.y = abs(p.y);
    float a = (ra*ra - rb*rb + d*d)/(2.0*d);
    float b = sqrt(max(ra*ra-a*a,0.0));
    if( d*(p.x*b-p.y*a) > d*d*max(b-p.y,0.0) )
          return length(p-vec2(a,b));
    return max( (length(p          )-ra),
               -(length(p-vec2(d,0))-rb));
}

float sdHeart( in vec2 p )
{
    p.x = abs(p.x);

    if( p.y+p.x>1.0 ) return sqrt(dot2(p-vec2(0.25,0.75))) - sqrt(2.0)/4.0;
    return sqrt(min(dot2(p-vec2(0.00,1.00)),
                    dot2(p-0.5*max(p.x+p.y,0.0)))) * sign(p.x-p.y);
}

// Render functions for SDFs
float circleRender(vec2 p, float r) {
    return s_lt(length(p), r, 0.005);
}

float hollowCircleRender(vec2 p, float r, float t) {
    return s_between(length(p), r-t, r, 0.005);
}

float segmentRender(vec2 p, vec2 a, vec2 b, float w) {
    return s_lt(sdSegment(p, a, b), w, 0.005);
}

float scene(vec2 xy) {
    float s1 = sdCircle(xy-vec2(1,1), 0.5);
    float s2 = sdCircle(xy-vec2(-1,-1), 0.5);
    float star = sdStar5(xy, 0.5, 0.5);
    float heart = sdHeart(xy-vec2(-1,0.5));
    float moon = sdMoon(xy-vec2(-1,-1), 0.5, 0.75, 0.6);
    return min(s1, min(s2, min(star, min(heart, moon))));
}


void main() {
    // Get UV from vertex shader
    vec2 uv = vUv.xy;
    
    // Setting up view port
    float zoom = 8.;
    vec2 zoomCenter = vec2(0., 0.);
    vec2 viewPortCenter = vec2(0.5, 0.5);

    // Establishing mouse xy values
    vec2 mouse = u_mousePos;
    mouse.x *= zoom/2.;
    mouse.y *= zoom/2. * u_ratio;

    // Establishing current xy values
    vec2 current = u_currentPos;
    current.x *= zoom/2.;
    current.y *= zoom/2. * u_ratio;

    // Establishing screen xy values
    vec2 xy = (uv - viewPortCenter) * zoom + zoomCenter;
    xy = vec2(xy.x, xy.y*u_ratio);    

    vec3 col = vec3(0);

    // Ray definition
    vec2 rd = normalize(mouse - current);
    vec2 ro = current;

    col.r += circleRender(ro-xy, 0.1);

    // Render Scene
    float sceneDis = scene(xy);
    col += sin(sceneDis*100.)*0.2;
    col += s_lt(sceneDis, 0., 0.005);

    col = max(col, vec3(0));

    // Ray marching
    float d = 0.;
    float cd;
    vec2 p;
    for (int i = 0; i < int(u_steps); i++) {
        p = ro + d * rd;
        cd = scene(p);
        if (cd < u_eps || d > u_maxDis) break;
        d += cd;

        col.g += circleRender(p-xy, 0.025);
        col += hollowCircleRender(p-xy, cd, 0.01);
    }

    col.r += segmentRender(xy, ro, p, 0.01);

    if (d < u_maxDis) col.b += circleRender(p-xy, 0.05);

    col.r += circleRender(mouse-xy, 0.1);

    gl_FragColor = vec4(col ,1);
}
`