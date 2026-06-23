<template>
  <aside class="sidebar">
    <div class="sidebar-logo">
      <div class="logo-icon"><i class="ti ti-grid-dots" /></div>
      <div class="logo-text">
        <div class="name">occuvision</div>
        <div class="sub">cmu | camt</div>
      </div>
    </div>

    <div class="sidebar-section">
      <div class="sidebar-section-label">main</div>
      <router-link class="nav-item" to="/"><i class="ti ti-home" />home</router-link>
      <router-link class="nav-item" to="/rooms"><i class="ti ti-door" />rooms</router-link>
      <router-link class="nav-item" to="/analytics"><i class="ti ti-chart-bar" />analytics</router-link>
      <a class="nav-item" href="#">
        <i class="ti ti-bell" />alerts
        <span class="nav-badge">1</span>
      </a>
    </div>

    <div class="sidebar-section">
      <div class="sidebar-section-label">manage</div>
      <a class="nav-item" href="#">
        <i class="ti ti-camera" />cameras
        <span class="nav-badge">2</span>
      </a>
      <a class="nav-item" href="#"><i class="ti ti-user" />admin</a>
      <a class="nav-item" href="#"><i class="ti ti-settings" />settings</a>
    </div>

    <div class="sidebar-footer">
      <div class="avatar">mm</div>
      <div class="footer-text">
        <div class="name">manager mario</div>
        <div class="role">facility manager</div>
      </div>
    </div>
  </aside>
</template>

<script setup>
// router-link automatically adds the .router-link-active class when the
// route matches, which maps onto your existing .nav-item.active CSS rule.
</script>

<style>
/* Make router-link-active match your existing .nav-item.active style */
.nav-item.router-link-active {
  background: #f0f0ee;
  color: var(--color-text-primary);
  font-weight: 500;
}
</style>
