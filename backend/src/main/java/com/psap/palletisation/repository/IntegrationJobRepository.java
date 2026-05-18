package com.psap.palletisation.repository;

import com.psap.palletisation.entity.IntegrationJobEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface IntegrationJobRepository extends JpaRepository<IntegrationJobEntity, Long> {
    Optional<IntegrationJobEntity> findByJobId(String jobId);
    Optional<IntegrationJobEntity> findByOrderId(String orderId);
    Optional<IntegrationJobEntity> findTopByOrderIdOrderByStartedAtDesc(String orderId);
}
