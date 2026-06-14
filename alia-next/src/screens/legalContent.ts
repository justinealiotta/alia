/* ───────────────────────────────────────────────────────────────────────────
   pages/legalContent.ts — the Privacy Policy / Terms of Service copy as static
   HTML strings rendered by <Legal> (markup uses the .doc-* classes in
   shared/legal.css).
   ─────────────────────────────────────────────────────────────────────────── */

export const PRIVACY_HTML = `
<h1 class="doc-title">Privacy Policy</h1>
            <p class="updated">Last updated: February 2026</p>

            <div class="intro">
              <p>This Privacy Policy explains how Alia (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) collects, uses, and handles information when you apply for, access, log into, or use Alia (the &ldquo;Service&rdquo;).</p>
              <p>By applying for, logging into, accessing, or otherwise using the Service, you acknowledge this Privacy Policy and consent to the collection and use of information as described herein. If you do not agree, do not use the Service.</p>
            </div>

            <div class="doc-section">
              <h2><span class="num">01</span>Information We Collect</h2>
              <h3>Information You Provide</h3>
              <p class="doc-p doc-lead">When you apply for or use Alia, we may collect:</p>
              <ul class="doc-ul">
                <li>name or display name</li>
                <li>date of birth (to confirm eligibility)</li>
                <li>city or general location</li>
                <li>profile photos or uploaded images</li>
                <li>application photos</li>
                <li>posts, messages, links, screenshots, and other materials you share</li>
                <li>social media handles if you choose to provide them</li>
              </ul>
              <h3>Information Collected Automatically</h3>
              <p class="doc-p doc-lead">We may also collect:</p>
              <ul class="doc-ul">
                <li>login and account activity</li>
                <li>device and browser information</li>
                <li>approximate IP-based location</li>
                <li>timestamps of actions</li>
                <li>technical logs needed to operate, maintain, and secure the Service</li>
              </ul>
            </div>

            <div class="doc-section">
              <h2><span class="num">02</span>How We Use Information</h2>
              <p class="doc-p doc-lead">We use collected information to:</p>
              <ul class="doc-ul">
                <li>review applications and manage membership</li>
                <li>operate and maintain the Service</li>
                <li>display posts and user profiles</li>
                <li>communicate with users regarding accounts, updates, or operational notices</li>
                <li>improve features, performance, and reliability</li>
                <li>prevent abuse, spam, or unauthorized access</li>
                <li>enforce our Terms of Service</li>
              </ul>
            </div>

            <div class="doc-section">
              <h2><span class="num">03</span>Automated Processing and System Learning</h2>
              <p class="doc-p">To operate and improve the Service, Alia may use automated systems that analyze uploaded materials, posts, messages, activity patterns, and other usage signals.</p>
              <p class="doc-p doc-lead" style="margin-top:8px">These systems may be used to:</p>
              <ul class="doc-ul">
                <li>assist in application review and membership management</li>
                <li>identify trends, repeated topics, or commonly referenced items</li>
                <li>analyze aggregated posting patterns, interaction density, or activity rhythms</li>
                <li>support moderation, safety, and platform integrity</li>
                <li>generate system observations, summaries, or informational content within the Service</li>
                <li>improve reliability, performance, and future feature development</li>
              </ul>
              <p class="doc-p" style="margin-top:8px">Some automated features may use aggregated behavioral signals from activity across the Service to help the system recognize recurring patterns or topics. This processing operates on grouped usage data and is not intended to identify personal traits or make judgments about individual users.</p>
              <p class="doc-p">Automated processing assists operational decisions and system features but does not guarantee any particular outcome.</p>
              <p class="doc-p">We do not use automated systems to determine sensitive personal characteristics about users.</p>
            </div>

            <div class="doc-section">
              <h2><span class="num">04</span>How Materials and Posts Are Stored</h2>
              <p class="doc-p">Materials you upload (including images, posts, messages, and shared content) are stored on infrastructure used to operate the Service.</p>
              <p class="doc-p doc-lead" style="margin-top:8px">We retain uploaded materials and system records as long as needed to:</p>
              <ul class="doc-ul">
                <li>operate the Service</li>
                <li>maintain platform integrity and moderation history</li>
                <li>support system analytics and improvement</li>
                <li>enforce Terms</li>
                <li>comply with legal obligations</li>
              </ul>
            </div>

            <div class="doc-section">
              <h2><span class="num">05</span>Sharing of Information</h2>
              <p class="doc-p">We do not sell personal information.</p>
              <p class="doc-p doc-lead" style="margin-top:8px">We may share information only when necessary to operate the Service, including with:</p>
              <ul class="doc-ul">
                <li>cloud hosting providers</li>
                <li>database and storage providers</li>
                <li>authentication providers</li>
                <li>analytics or monitoring tools</li>
                <li>service providers that help run the Service</li>
              </ul>
              <p class="doc-p" style="margin-top:8px">These providers process data only as needed to support the Service.</p>
              <p class="doc-p">We may also disclose information if required by law or to protect the safety, rights, or integrity of the Service.</p>
            </div>

            <div class="doc-section">
              <h2><span class="num">06</span>Security</h2>
              <p class="doc-p">We use reasonable technical and organizational safeguards designed to protect information from unauthorized access, loss, or misuse. However, no online system can be guaranteed completely secure.</p>
            </div>

            <div class="doc-section">
              <h2><span class="num">07</span>Account Deletion</h2>
              <p class="doc-p">You may request deletion of your account through available account settings or by contacting us.</p>
              <p class="doc-p">Deleting your account will disable your access to the Service and remove your active profile. However, materials, posts, messages, and activity previously shared within the Service may remain stored within our systems, including for operational, safety, integrity, analytics, or system-improvement purposes. Where technically feasible, we may disassociate stored records from your active account.</p>
            </div>

            <div class="doc-section">
              <h2><span class="num">08</span>Age Requirement</h2>
              <p class="doc-p">Alia is not intended for individuals under 21. We do not knowingly collect information from individuals below this age.</p>
            </div>

            <div class="doc-section">
              <h2><span class="num">09</span>Changes to This Policy</h2>
              <p class="doc-p">We may update this Privacy Policy from time to time. Continued use of the Service after changes become effective constitutes acceptance of the updated policy.</p>
            </div>

            <div class="doc-section" style="margin-bottom:0">
              <h2><span class="num">10</span>Contact</h2>
              <p class="doc-p">For privacy-related questions, contact:</p>
              <p class="doc-p" style="margin-top:6px"><a href="mailto:justinealiotta@gmail.com">justinealiotta@gmail.com</a></p>
`;

export const TERMS_HTML = `
<h1 class="doc-title">Terms of Service</h1>
            <p class="updated">Last updated: February 2026</p>

            <div class="intro">
              <p>By applying for, accessing, logging into, or using Alia (the &ldquo;Service&rdquo;), you agree to these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree, do not use the Service. Continued access to the Service after logging in constitutes acceptance of these Terms.</p>
            </div>

            <div class="doc-section">
              <h2><span class="num">01</span>Eligibility</h2>
              <p class="doc-p">You must be at least 21 years old to apply for or use Alia. By using the Service, you confirm that you meet this requirement.</p>
            </div>

            <div class="doc-section">
              <h2><span class="num">02</span>Membership Is Limited and Discretionary</h2>
              <p class="doc-p">Alia operates as an invite-only fashion VIP room.</p>
              <p class="doc-p">Submission of an application does not guarantee admission. Access is limited and based on internal standards, fit for the room, and availability. Alia reserves the right to approve, waitlist, deny, suspend, remove, or modify access or membership privileges at its sole discretion.</p>
              <p class="doc-p">Alia may use automated tools, manual review, or a combination of both when evaluating applications and maintaining standards inside the Service.</p>
            </div>

            <div class="doc-section">
              <h2><span class="num">03</span>Account Information</h2>
              <p class="doc-p">You agree to provide accurate information when applying or creating a profile.</p>
              <p class="doc-p">You are responsible for maintaining the security of your login credentials and for all activity under your account.</p>
            </div>

            <div class="doc-section">
              <h2><span class="num">04</span>Posts, Uploads, and Shared Materials</h2>
              <p class="doc-p">You may upload or share photos, text, links, screenshots, and other materials (&ldquo;Materials&rdquo;).</p>
              <p class="doc-p">Some Materials you share may belong to you, and some may come from third parties (such as links to retailers, screenshots, editorial images, or publicly available media). You are responsible for ensuring that your sharing of Materials is lawful and does not violate applicable rights.</p>
              <p class="doc-p">By posting Materials, you grant Alia a non-exclusive, worldwide, royalty-free license to host, store, display, and process those Materials solely for purposes of operating, maintaining, and improving the Service.</p>
              <p class="doc-p">Alia reserves the right to remove any Materials at its discretion.</p>
            </div>

            <div class="doc-section">
              <h2><span class="num">05</span>Standards Inside the Service</h2>
              <p class="doc-p doc-lead">Alia maintains a curated experience. We may suspend or remove accounts that:</p>
              <ul class="doc-ul">
                <li>impersonate others</li>
                <li>engage in harassment, abusive conduct, discriminatory behavior, or use of hate speech or slurs</li>
                <li>attempt to bypass membership controls</li>
                <li>misuse invitation privileges</li>
                <li>use the Service for spam or unauthorized promotion</li>
                <li>otherwise interfere with the intended use of the Service</li>
                <li>or otherwise act in a way that undermines the safety or integrity of the Service</li>
              </ul>
            </div>

            <div class="doc-section">
              <h2><span class="num">06</span>Automated Processing</h2>
              <p class="doc-p">To maintain quality and functionality, Alia may process uploaded materials using automated systems, including systems that analyze images, text, and activity patterns.</p>
              <p class="doc-p">These systems assist operational decisions but do not guarantee any particular outcome.</p>
            </div>

            <div class="doc-section">
              <h2><span class="num">07</span>No Guarantee of Availability</h2>
              <p class="doc-p">The Service is provided on an &ldquo;as-is&rdquo; and &ldquo;as-available&rdquo; basis.</p>
              <p class="doc-p">We do not guarantee uninterrupted access, error-free operation, or permanent availability of any feature or content.</p>
            </div>

            <div class="doc-section">
              <h2><span class="num">08</span>Limitation of Liability</h2>
              <p class="doc-p doc-lead">To the fullest extent permitted by law, Alia shall not be liable for:</p>
              <ul class="doc-ul">
                <li>indirect or consequential damages</li>
                <li>loss of data or opportunity</li>
                <li>actions taken by other users</li>
              </ul>
              <p class="doc-p" style="margin-top:8px">Your use of the Service is at your own risk.</p>
            </div>

            <div class="doc-section">
              <h2><span class="num">09</span>Termination</h2>
              <p class="doc-p">We may suspend or terminate access to the Service at any time, with or without notice, if we believe these Terms have been violated or continuation would harm the Service or its members.</p>
            </div>

            <div class="doc-section">
              <h2><span class="num">10</span>Changes to These Terms</h2>
              <p class="doc-p">We may update these Terms from time to time. Continued use of the Service after changes become effective constitutes acceptance of the revised Terms.</p>
            </div>

            <div class="doc-section" style="margin-bottom:0">
              <h2><span class="num">11</span>Contact</h2>
              <p class="doc-p">For questions regarding these Terms, contact:</p>
              <p class="doc-p" style="margin-top:6px"><a href="mailto:justinealiotta@gmail.com">justinealiotta@gmail.com</a></p>
            </div>

            <div class="acknowledge">
              <p>By applying for or using Alia, you acknowledge that you have read and agree to these Terms of Service.</p>
`;
